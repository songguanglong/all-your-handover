import type { Router } from 'express';
import type { AgentSoul, DreamConfig } from '../types';
import { getSoul, saveSoul, resetSoul, getTemplates } from '../services/agent-soul-service';
import { getExperience, removeEntry } from '../services/experience-service';
import { getDreamConfig, saveDreamConfig, runDream } from '../services/dream-service';
import { llmProviderFactory } from '../llm/llm-provider-factory';
import { sanitizeError } from './sanitize-error';

const VALID_CODE = /^[a-zA-Z0-9_]{1,50}$/;

function validateCode(code: string): boolean {
  return VALID_CODE.test(code);
}

export function registerAgentRoutes(router: Router, prefix: string): void {
  // --- Agent Soul ---

  router.get(`${prefix}/channels/:code/agent/soul`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      const soul = await getSoul(code);
      res.json({ code: 0, data: { soul } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.put(`${prefix}/channels/:code/agent/soul`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      const soul = req.body as AgentSoul;
      if (!soul.persona) return res.status(400).json({ code: -1, message: 'persona is required' });
      await saveSoul(code, soul);
      res.json({ code: 0 });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.put(`${prefix}/channels/:code/agent/soul/reset`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      await resetSoul(code);
      const soul = await getSoul(code);
      res.json({ code: 0, data: { soul } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.get(`${prefix}/channels/:code/agent/soul/templates`, async (_req, res) => {
    try {
      const templates = getTemplates();
      res.json({ code: 0, data: { templates } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // --- Experience ---

  router.get(`${prefix}/channels/:code/agent/experience`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      const experience = await getExperience(code);
      res.json({ code: 0, data: { entries: experience.entries, lastDreamAt: experience.lastDreamAt } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.delete(`${prefix}/channels/:code/agent/experience/:id`, async (req, res) => {
    try {
      const { code, id } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      await removeEntry(code, id);
      res.json({ code: 0 });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // --- Dream Config ---

  router.get(`${prefix}/channels/:code/agent/dream-config`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      const config = await getDreamConfig(code);
      res.json({ code: 0, data: { config } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  router.put(`${prefix}/channels/:code/agent/dream-config`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      const config = req.body as DreamConfig;
      if (typeof config.enabled !== 'boolean') return res.status(400).json({ code: -1, message: 'enabled is required' });
      if (typeof config.cronHour !== 'number' || config.cronHour < 0 || config.cronHour > 23) {
        return res.status(400).json({ code: -1, message: 'cronHour must be 0-23' });
      }
      await saveDreamConfig(code, config);
      res.json({ code: 0 });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Manual dream trigger
  router.post(`${prefix}/channels/:code/agent/dream/trigger`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });

      if (!llmProviderFactory.hasDefault()) {
        return res.status(400).json({ code: -1, message: '未配置默认 LLM Provider' });
      }

      const provider = llmProviderFactory.getDefault();
      const chatCompletion = (messages: Array<{ role: string; content: string }>) => provider.chatCompletion(messages, 'deep');
      const report = await runDream(code, chatCompletion);

      if (!report) {
        return res.json({ code: 0, data: { message: '没有经验规则可供反思' } });
      }

      res.json({ code: 0, data: { report } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });
}