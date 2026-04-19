import type { Router } from 'express';
import { getTemplate, saveTemplate, getDefaultTemplate, getSystemPrompt, saveSystemPrompt, getDefaultSystemPrompt } from '../services/config-service';
import { llmProviderFactory } from '../llm/llm-provider-factory';
import { sanitizeError } from './sanitize-error';

const VALID_CODE = /^[a-zA-Z0-9_]{1,50}$/;

const INTERVIEW_SYSTEM_PROMPT = `你是一个系统提示词设计助手。你的任务是通过对话帮助用户设计交接班系统的系统提示词。

规则:
1. 每次只问一个问题，简短明确
2. 先了解业务场景（什么行业、什么岗位交接），再了解输出要求（语气、格式偏好、特殊关注点）
3. 问了3-4个问题后，基于对话内容生成一个完整的系统提示词
4. 生成提示词时，以 "【系统提示词】" 开头，然后给出完整的提示词内容
5. 生成的提示词应该是给 LLM 的指令，描述角色、任务和输出要求
6. 不要在提示词中硬编码具体的行业假设，让用户自己的描述决定内容
7. 如果用户回答模糊，追问具体细节

开始时，先问用户："你的交接班是用于什么业务场景的？比如酒店、工厂、医院等。"`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function validateCode(code: string): boolean {
  return VALID_CODE.test(code);
}

export function registerTemplateRoutes(router: Router, prefix: string): void {
  // Get channel template
  router.get(`${prefix}/channels/:code/template`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
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
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
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
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      await saveTemplate(code, getDefaultTemplate());
      res.json({ code: 0, data: { template: getDefaultTemplate() } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Get system prompt
  router.get(`${prefix}/channels/:code/system-prompt`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      const systemPrompt = await getSystemPrompt(code);
      res.json({ code: 0, data: { systemPrompt } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Update system prompt
  router.put(`${prefix}/channels/:code/system-prompt`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      const { systemPrompt } = req.body;
      if (typeof systemPrompt !== 'string') return res.status(400).json({ code: -1, message: 'systemPrompt required' });
      if (systemPrompt.length > 4096) return res.status(400).json({ code: -1, message: '系统提示词不能超过4096字符' });
      await saveSystemPrompt(code, systemPrompt);
      res.json({ code: 0 });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Reset system prompt to default
  router.put(`${prefix}/channels/:code/system-prompt/reset`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });
      const defaultPrompt = getDefaultSystemPrompt();
      await saveSystemPrompt(code, defaultPrompt);
      res.json({ code: 0, data: { systemPrompt: defaultPrompt } });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });

  // Interview-style system prompt generation
  router.post(`${prefix}/channels/:code/system-prompt/interview`, async (req, res) => {
    try {
      const { code } = req.params;
      if (!validateCode(code)) return res.status(400).json({ code: -1, message: 'Invalid channel code' });

      const { messages } = req.body as { messages?: ChatMessage[] };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ code: -1, message: 'messages 数组不能为空' });
      }

      if (!llmProviderFactory.hasDefault()) {
        return res.status(400).json({ code: -1, message: '未配置默认 LLM Provider' });
      }

      const provider = llmProviderFactory.getDefault();
      const chatMessages = [
        { role: 'system' as const, content: INTERVIEW_SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ];

      const result = await provider.chatCompletion(chatMessages);

      // Check if the result contains a proposed prompt
      const promptMatch = result.match(/【系统提示词】\s*([\s\S]*)/);
      const proposedPrompt = promptMatch ? promptMatch[1].trim() : null;

      res.json({
        code: 0,
        data: {
          reply: result,
          proposedPrompt,
        },
      });
    } catch (err) {
      res.status(500).json({ code: -1, message: sanitizeError(err) });
    }
  });
}