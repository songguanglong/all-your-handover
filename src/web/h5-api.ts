import type { Router, Request, Response } from 'express';
import { readPreview, updatePreview, removeItemFromPreview } from '../services/draft-preview-service';
import { readRawRecords } from '../services/draft-raw-service';
import { readAnalysis, completenessCheck, markItemShift } from '../services/draft-analysis-service';
import { handleHandoverStart, handleHandoverAccept, handleHandoverReject } from '../services/handover-orchestrator';
import { findPendingHandover, removePendingHandover } from '../services/handover-service';
import { getChannelConfig } from '../services/config-service';
import { channelFactory } from '../channels/channel-factory';
import { detectDiffs } from '../services/diff-detector';
import { recordDiffCandidate } from '../services/channel-memory-service';
import { analyzeEditIntent, addEntry } from '../services/experience-service';
import { llmProviderFactory } from '../llm/llm-provider-factory';
import { logger } from '../utils/logger';
import type { AnalysisItem } from '../types';
import { onDraftUpdate, offDraftUpdate, notifyDraftUpdate } from './draft-events';
import { h5RequireAuth } from './h5-session-auth';

interface DraftResponse {
  preview: string | null;
  rawCount: number;
  analyzedCount: number;
  missingCount: number;
  items: AnalysisItem[];
  lastUpdated: string;
}

interface HandoverStartResponse {
  success: boolean;
  message: string;
  missingCount?: number;
}

interface HandoverAcceptResponse {
  success: boolean;
  message: string;
}

interface HandoverRejectResponse {
  success: boolean;
  message: string;
}

const MAX_SSE_CONNECTIONS = 50;
let activeSSEConnections = 0;

export function registerH5Routes(router: Router, prefix: string): void {
  // SSE endpoint for real-time draft updates
  router.get(`${prefix}/draft/:code/events`, async (req: Request, res: Response) => {
    const channelCode = req.params.code;
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
      return res.status(400).json({ code: -1, message: '无效的渠道代码' });
    }

    if (activeSSEConnections >= MAX_SSE_CONNECTIONS) {
      return res.status(429).json({ code: -1, message: '连接数已满，请稍后再试' });
    }
    activeSSEConnections++;

    // Ensure counter is decremented even if setup throws
    let cleaned = false;
    const decrement = () => { if (!cleaned) { cleaned = true; activeSSEConnections--; } };

    try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial heartbeat
    res.write('event: connected\ndata: {}\n\n');

    const handler = () => {
      try {
        res.write(`event: update\ndata: ${JSON.stringify({ channelCode })}\n\n`);
      } catch {
        offDraftUpdate(channelCode, handler);
        clearInterval(heartbeat);
      }
    };

    // Periodic heartbeat to keep connection alive (proxies/browsers close idle connections)
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        offDraftUpdate(channelCode, handler);
        clearInterval(heartbeat);
      }
    }, 30000);

    onDraftUpdate(channelCode, handler);

    // Cleanup on close
    req.on('close', () => {
      decrement();
      offDraftUpdate(channelCode, handler);
      clearInterval(heartbeat);
    });
    } catch {
      decrement();
    }
  });

  // Lightweight status poll (for H5 periodic check — avoids fetching full preview)
  router.get(`${prefix}/draft/:code/status`, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }

      const [analysis, check] = await Promise.all([
        readAnalysis(channelCode),
        completenessCheck(channelCode),
      ]);

      res.json({
        code: 0,
        data: {
          rawCount: check.totalRaw,
          analyzedCount: check.totalAnalyzed,
          missingCount: check.missing,
          lastUpdated: analysis.lastUpdated,
          itemCount: analysis.items.length,
        },
      });
    } catch (err) {
      res.status(500).json({ code: -1, message: '获取状态失败' });
    }
  });

  // Get draft data (raw + analysis + preview)
  router.get(`${prefix}/draft/:code`, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }

      const [preview, rawRecords, analysis, check] = await Promise.all([
        readPreview(channelCode),
        readRawRecords(channelCode),
        readAnalysis(channelCode),
        completenessCheck(channelCode),
      ]);

      const response: DraftResponse = {
        preview,
        rawCount: check.totalRaw,
        analyzedCount: check.totalAnalyzed,
        missingCount: check.missing,
        items: analysis.items.filter(i => !i.recalled),
        lastUpdated: analysis.lastUpdated,
      };

      res.json({ code: 0, data: response });
    } catch (err) {
      res.status(500).json({ code: -1, message: '获取草稿失败' });
    }
  });

  // Update preview.md (user edits) — requires auth
  router.put(`${prefix}/draft/:code/preview`, h5RequireAuth, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      const { content } = req.body;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }
      if (typeof content !== 'string') {
        return res.status(400).json({ code: -1, message: '内容必须是字符串' });
      }

      // Read old state before overwrite (for diff detection + experience learning)
      const oldPreview = await readPreview(channelCode);
      const analysis = await readAnalysis(channelCode);

      await updatePreview(channelCode, content);

      notifyDraftUpdate(channelCode);

      // P1-2: Diff detection on preview save
      if (oldPreview && analysis.items.length > 0) {
        const URGENCY_LABEL: Record<string, string> = { high: '紧急', normal: '一般', low: '低' };
        for (const item of analysis.items) {
          const marker = `<!-- msg:${item.msgId} -->`;
          if (!content.includes(marker)) {
            // Marker removed — user modified or deleted this item
            await recordDiffCandidate(channelCode, {
              type: 'content',
              msgId: item.msgId,
              from: item.content,
              to: '(用户编辑/删除)',
              label: '',
              timestamp: new Date().toISOString(),
            });
          } else {
            // Marker still present — parse the line and compare
            const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const lineRegex = new RegExp(`^- (.+?) \\((.+?)\\) <!-- msg:${escapeRegex(item.msgId)} -->$`, 'm');
            const match = content.match(lineRegex);
            if (match) {
              const newUrgencyKey = (Object.entries(URGENCY_LABEL).find(([, v]) => v === match[2])?.[0] ?? 'normal') as 'high' | 'normal' | 'low';
              const modified: AnalysisItem = {
                msgId: item.msgId,
                category: item.category,
                content: match[1],
                urgency: newUrgencyKey,
              };
              const diffs = detectDiffs(item, modified);
              for (const diff of diffs) {
                await recordDiffCandidate(channelCode, diff);
              }
            }
          }
        }
      }

      // P1-3: Experience learning from user edits
      if (oldPreview && oldPreview !== content) {
        try {
          const provider = llmProviderFactory.hasDefault() ? llmProviderFactory.getDefault() : null;
          if (provider) {
            const entry = await analyzeEditIntent(
              channelCode,
              oldPreview,
              content,
              (messages) => provider.chatCompletion(messages, 'quick')
            );
            if (entry) {
              await addEntry(channelCode, entry);
            }
          }
        } catch (err) {
          logger.warn(`经验分析失败: ${err instanceof Error ? err.message : err}`);
        }
      }

      res.json({ code: 0, message: '预览已更新' });
    } catch (err) {
      res.status(500).json({ code: -1, message: '更新预览失败' });
    }
  });

  // Start handover (snapshot) — requires auth
  router.post(`${prefix}/handover/:code/start`, h5RequireAuth, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      const { senderId, senderName } = req.body;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }

      const channelConfig = await getChannelConfig(channelCode);
      if (!channelConfig) {
        return res.status(404).json({ code: -1, message: '渠道不存在' });
      }

      let channel;
      try {
        channel = channelFactory.get(channelCode);
      } catch {
        return res.status(404).json({ code: -1, message: '渠道未初始化' });
      }

      const sender = { id: senderId || 'h5_user', name: senderName || 'H5用户' };
      const chatId = channelConfig.chatId;

      // Check completeness first
      const check = await completenessCheck(channelCode);

      const preview = await readPreview(channelCode);
      if (!preview || !preview.trim()) {
        return res.json({ code: -1, message: '当前没有草稿内容，无法发起交接' });
      }

      const rawPending = await findPendingHandover(channelCode);
      if (rawPending) {
        return res.json({ code: -1, message: '当前已有待交接记录，请等待接班人确认或取消后再试' });
      }

      await handleHandoverStart(sender, channel, chatId, channelCode);

      res.json({
        code: 0,
        data: {
          success: true,
          message: '交接已发起',
          missingCount: check.missing,
        } as HandoverStartResponse,
      });
    } catch (err) {
      res.status(500).json({ code: -1, message: '发起交接失败' });
    }
  });

  // Accept handover (confirm) — requires auth
  router.post(`${prefix}/handover/:code/accept`, h5RequireAuth, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      const { receiverId, receiverName } = req.body;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }

      const channelConfig = await getChannelConfig(channelCode);
      if (!channelConfig) {
        return res.status(404).json({ code: -1, message: '渠道不存在' });
      }

      let channel;
      try {
        channel = channelFactory.get(channelCode);
      } catch {
        return res.status(404).json({ code: -1, message: '渠道未初始化' });
      }

      const receiver = { id: receiverId || 'h5_receiver', name: receiverName || '接班人' };
      const chatId = channelConfig.chatId;

      await handleHandoverAccept(receiver, channel, chatId, channelCode);

      res.json({ code: 0, data: { success: true, message: '接班确认成功' } as HandoverAcceptResponse });
    } catch (err) {
      res.status(500).json({ code: -1, message: '接班确认失败' });
    }
  });

  // Reject handover (打回) — requires auth
  router.post(`${prefix}/handover/:code/reject`, h5RequireAuth, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }

      const channelConfig = await getChannelConfig(channelCode);
      if (!channelConfig) {
        return res.status(404).json({ code: -1, message: '渠道不存在' });
      }

      let channel;
      try {
        channel = channelFactory.get(channelCode);
      } catch {
        return res.status(404).json({ code: -1, message: '渠道未初始化' });
      }

      const chatId = channelConfig.chatId;
      await handleHandoverReject(channel, chatId, channelCode);

      res.json({ code: 0, data: { success: true, message: '已打回，交班人可重新编辑' } as HandoverRejectResponse });
    } catch (err) {
      res.status(500).json({ code: -1, message: '打回操作失败' });
    }
  });

  // Assign shift to a message item (纳入交接 / 归入下一班) — requires auth
  router.post(`${prefix}/draft/:code/assign-shift`, h5RequireAuth, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      const { msgId, shift } = req.body;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }
      if (!msgId || typeof msgId !== 'string') {
        return res.status(400).json({ code: -1, message: '缺少msgId参数' });
      }
      if (shift !== 'current' && shift !== 'next') {
        return res.status(400).json({ code: -1, message: 'shift必须是current或next' });
      }

      await markItemShift(channelCode, msgId, shift);

      if (shift === 'next') {
        // Remove from preview.md
        await removeItemFromPreview(channelCode, msgId);
      }

      notifyDraftUpdate(channelCode);

      res.json({ code: 0, message: shift === 'current' ? '已纳入当前交接' : '已归入下一班' });
    } catch (err) {
      res.status(500).json({ code: -1, message: '操作失败' });
    }
  });

  // Check pending handover state
  router.get(`${prefix}/handover/:code/pending`, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }

      const pending = await findPendingHandover(channelCode);
      if (!pending) {
        return res.json({ code: 0, data: null });
      }

      res.json({ code: 0, data: pending });
    } catch (err) {
      res.status(500).json({ code: -1, message: '查询失败' });
    }
  });
}