import type { Router, Request, Response } from 'express';
import { readPreview, updatePreview } from '../services/draft-preview-service';
import { readRawRecords } from '../services/draft-raw-service';
import { readAnalysis, completenessCheck } from '../services/draft-analysis-service';
import { handleHandoverStart, handleHandoverAccept, handleHandoverReject } from '../services/handover-orchestrator';
import { findPendingHandover, removePendingHandover } from '../services/handover-service';
import { getChannelConfig } from '../services/config-service';
import { channelFactory } from '../channels/channel-factory';

interface DraftResponse {
  preview: string | null;
  rawCount: number;
  analyzedCount: number;
  missingCount: number;
  items: Array<{ msgId: string; category: string; content: string; urgency: string }>;
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

export function registerH5Routes(router: Router, prefix: string): void {
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
        items: analysis.items,
      };

      res.json({ code: 0, data: response });
    } catch (err) {
      res.status(500).json({ code: -1, message: '获取草稿失败' });
    }
  });

  // Update preview.md (user edits)
  router.put(`${prefix}/draft/:code/preview`, async (req: Request, res: Response) => {
    try {
      const channelCode = req.params.code;
      const { content } = req.body;
      if (!/^[a-zA-Z0-9_]{1,50}$/.test(channelCode)) {
        return res.status(400).json({ code: -1, message: '无效的渠道代码' });
      }
      if (typeof content !== 'string') {
        return res.status(400).json({ code: -1, message: '内容必须是字符串' });
      }

      await updatePreview(channelCode, content);
      res.json({ code: 0, message: '预览已更新' });
    } catch (err) {
      res.status(500).json({ code: -1, message: '更新预览失败' });
    }
  });

  // Start handover (snapshot)
  router.post(`${prefix}/handover/:code/start`, async (req: Request, res: Response) => {
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

  // Accept handover (confirm)
  router.post(`${prefix}/handover/:code/accept`, async (req: Request, res: Response) => {
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

  // Reject handover (打回)
  router.post(`${prefix}/handover/:code/reject`, async (req: Request, res: Response) => {
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
}