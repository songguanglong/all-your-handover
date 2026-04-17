import type { Request, Response } from 'express';
import { loadLLMProvidersConfig, saveLLMProvidersConfig } from '../services/config-service';
import { encrypt } from '../utils/encryption';
import { llmProviderFactory } from '../llm/llm-provider-factory';
import { logger } from '../utils/logger';

function sanitizeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal error';
}

const VALID_PROVIDER_TYPES = ['openai', 'deepseek', 'moonshot'];

export function registerLLMRoutes(router: import('express').Router, prefix: string): void {
  // List all LLM providers
  router.get(`${prefix}/llm-providers`, async (_req: Request, res: Response) => {
    try {
      const config = await loadLLMProvidersConfig();
      // Mask API keys in response
      const masked = config.providers.map(p => ({
        ...p,
        apiKey: p.apiKey ? '***' : '',
      }));
      res.json({ code: 0, data: { providers: masked, defaultProviderId: config.defaultProviderId } });
    } catch (err) {
      logger.error(`List providers error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Create a new LLM provider
  router.post(`${prefix}/llm-providers`, async (req: Request, res: Response) => {
    try {
      const { name, type, apiKey, baseUrl, model, isDefault, isEnabled } = req.body;
      if (!name || !type || !apiKey || !baseUrl || !model) {
        return res.status(400).json({ code: -1, message: 'Missing required fields' });
      }
      if (!VALID_PROVIDER_TYPES.includes(type)) {
        return res.status(400).json({ code: -1, message: `Invalid provider type: ${type}` });
      }

      const config = await loadLLMProvidersConfig();
      const id = `p_${Date.now()}`;
      const now = new Date().toISOString();
      const encryptedKey = await encrypt(String(apiKey));

      const provider = {
        id, name: String(name).slice(0, 100), type, apiKey: encryptedKey,
        baseUrl: String(baseUrl).slice(0, 500), model: String(model).slice(0, 100),
        isDefault: isDefault || false,
        isEnabled: isEnabled !== false,
        createdAt: now, updatedAt: now,
      };

      config.providers.push(provider);
      if (provider.isDefault) config.defaultProviderId = id;

      await saveLLMProvidersConfig(config);

      try {
        await llmProviderFactory.create({
          ...provider,
          apiKey: String(apiKey),
        });
      } catch (err) {
        logger.error(`Provider init error: ${err}`);
      }

      res.json({ code: 0, data: { id } });
    } catch (err) {
      logger.error(`Create provider error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Update a LLM provider
  router.put(`${prefix}/llm-providers/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const config = await loadLLMProvidersConfig();
      const idx = config.providers.findIndex(p => p.id === id);
      if (idx === -1) return res.status(404).json({ code: -1, message: 'Provider not found' });

      const existing = config.providers[idx];
      const updates = req.body;
      const now = new Date().toISOString();

      const apiKey = updates.apiKey ? await encrypt(String(updates.apiKey)) : existing.apiKey;

      config.providers[idx] = {
        ...existing,
        name: updates.name ?? existing.name,
        type: updates.type ?? existing.type,
        apiKey,
        baseUrl: updates.baseUrl ?? existing.baseUrl,
        model: updates.model ?? existing.model,
        isEnabled: updates.isEnabled ?? existing.isEnabled,
        updatedAt: now,
      };

      if (updates.isDefault) config.defaultProviderId = id;

      await saveLLMProvidersConfig(config);
      await llmProviderFactory.reload();

      res.json({ code: 0 });
    } catch (err) {
      logger.error(`Update provider error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Delete a LLM provider
  router.delete(`${prefix}/llm-providers/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const config = await loadLLMProvidersConfig();
      config.providers = config.providers.filter(p => p.id !== id);
      if (config.defaultProviderId === id) config.defaultProviderId = null;
      await saveLLMProvidersConfig(config);
      await llmProviderFactory.reload();
      res.json({ code: 0 });
    } catch (err) {
      logger.error(`Delete provider error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Set default provider
  router.put(`${prefix}/llm-providers/:id/default`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const config = await loadLLMProvidersConfig();
      if (!config.providers.find(p => p.id === id)) {
        return res.status(404).json({ code: -1, message: 'Provider not found' });
      }
      config.defaultProviderId = id;
      await saveLLMProvidersConfig(config);
      res.json({ code: 0 });
    } catch (err) {
      logger.error(`Set default provider error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Toggle provider enabled/disabled
  router.put(`${prefix}/llm-providers/:id/toggle`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const config = await loadLLMProvidersConfig();
      const provider = config.providers.find(p => p.id === id);
      if (!provider) return res.status(404).json({ code: -1, message: 'Provider not found' });
      provider.isEnabled = !provider.isEnabled;
      provider.updatedAt = new Date().toISOString();
      await saveLLMProvidersConfig(config);
      await llmProviderFactory.reload();
      res.json({ code: 0, data: { isEnabled: provider.isEnabled } });
    } catch (err) {
      logger.error(`Toggle provider error: ${err}`);
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });
}