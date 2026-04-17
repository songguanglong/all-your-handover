import type { Router } from 'express';
import { getTemplate, saveTemplate, getDefaultTemplate } from '../services/config-service';

function sanitizeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal error';
}

export function registerTemplateRoutes(router: Router, prefix: string): void {
  // Get channel template
  router.get(`${prefix}/channels/:code/template`, async (req, res) => {
    try {
      const { code } = req.params;
      const template = await getTemplate(code);
      res.json({ code: 0, data: { template } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Update channel template
  router.put(`${prefix}/channels/:code/template`, async (req, res) => {
    try {
      const { code } = req.params;
      const { template } = req.body;
      if (!template) return res.status(400).json({ code: -1, message: 'Template content required' });
      await saveTemplate(code, template);
      res.json({ code: 0 });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Reset to default template
  router.put(`${prefix}/channels/:code/template/reset`, async (req, res) => {
    try {
      const { code } = req.params;
      await saveTemplate(code, getDefaultTemplate());
      res.json({ code: 0, data: { template: getDefaultTemplate() } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });
}