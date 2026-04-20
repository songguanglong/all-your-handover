import type { Express, Request, Response } from 'express';
import { verifyFeishuSignature } from './feishu-signature';
import { channelFactory } from './channel-factory';
import { findChannelCodeByChatId, getChannelConfig } from '../services/config-service';
import { handleTextMessage, handleImageMessage, handleAudioMessage } from '../services/record-service';
import { handleHandoverStart, handleHandoverAccept, handleHandoverCancel, handleDraftView } from '../services/handover-orchestrator';
import { handleCardAction } from '../services/card-callback-service';
import { llmProviderFactory } from '../llm/llm-provider-factory';
import { addReaction } from '../services/reaction-service';
import { getApp } from '../app';
import type { CardAction, LLMTask } from '../types';
import { logger } from '../utils/logger';

export function registerWebhookRoutes(app: Express): void {
  // Feishu event webhook
  app.post('/webhook/feishu', async (req: Request, res: Response) => {
    try {
      if (!await verifyFeishuSignature(req)) {
        return res.status(403).json({ code: -1, msg: '签名验证失败' });
      }

      const body = req.body;

      // Challenge verification (first-time setup)
      if (body.challenge) {
        return res.json({ challenge: body.challenge });
      }

      const chatId = body.event?.message?.chat_id;
      if (!chatId) {
        return res.json({ code: 0 });
      }

      const channelCode = await findChannelCodeByChatId(chatId);
      if (!channelCode) {
        return res.json({ code: 0 });
      }

      const channel = channelFactory.get(channelCode);
      const message = await channel.receiveMessage(body);
      const getProvider = () => llmProviderFactory.hasDefault() ? llmProviderFactory.getDefault() : null;
      if (!message) {
        return res.json({ code: 0 });
      }

      // Check for commands first (always detected regardless of messageFilter)
      const command = channel.parseCommand(message);
      if (command) {
        await addReaction(channel, message.id, '👀');

        switch (command.type) {
          case 'HANDOVER_START':
            await handleHandoverStart(command.sender, channel, chatId, channelCode, async (draft, template, previousHandover, systemPrompt, soulPrompt, experiencePrompt) => {
              if (llmProviderFactory.hasDefault()) {
                return llmProviderFactory.getDefault().generateHandover({
                  draft, template, previousHandover: previousHandover ?? undefined, systemPrompt, soulPrompt, experiencePrompt,
                });
              }
              return draft;
            });
            break;
          case 'HANDOVER_ACCEPT': {
            const getChatCompletion = () => {
              if (llmProviderFactory.hasDefault()) {
                const provider = llmProviderFactory.getDefault();
                return (messages: Array<{ role: string; content: string }>) => provider.chatCompletion(messages, 'standard');
              }
              return null;
            };
            await handleHandoverAccept(command.sender, channel, chatId, channelCode, getChatCompletion);
            break;
          }
          case 'HANDOVER_CANCEL':
            await handleHandoverCancel(command.sender, channel, chatId, channelCode);
            break;
          case 'DRAFT_VIEW':
            await handleDraftView(command.sender, channel, chatId, channelCode);
            break;
        }
        return res.json({ code: 0 });
      }

      // Otherwise treat as record message (respect messageFilter setting)
      const channelConfig = await getChannelConfig(channelCode);
      if (channelConfig?.settings.messageFilter === 'mention' && !message.mentionsBot) {
        return res.json({ code: 0 });
      }

      // If the message replies to another message, fetch parent content as context
      let quotedContext: string | undefined;
      if (message.parentId) {
        const parentContent = await channel.fetchMessageContent(message.parentId);
        if (parentContent) {
          quotedContext = parentContent;
        }
      }

      // Enqueue LLM task through the App's queue
      const appInstance = getApp();
      const enqueueLLM = (code: string, task: LLMTask) => {
        if (!appInstance) {
          logger.warn('App not initialized, skipping LLM task');
          return;
        }
        const wrappedTask: LLMTask = {
          execute: task.execute,
          onSuccess: task.onSuccess,
          onFailure: task.onFailure,
        };
        appInstance.llmQueue.enqueue(code, wrappedTask);
      };

      switch (message.type) {
        case 'text':
          await handleTextMessage(message, channel, channelCode, enqueueLLM, getProvider, quotedContext);
          break;
        case 'image':
          await handleImageMessage(message, channel, channelCode, enqueueLLM, getProvider, quotedContext);
          break;
        case 'audio':
          await handleAudioMessage(message, channel, channelCode, enqueueLLM, getProvider, quotedContext);
          break;
      }

      res.json({ code: 0 });
    } catch (err) {
      logger.error(`Webhook error: ${err instanceof Error ? err.stack : String(err)}`);
      // Return 200 to Feishu to prevent retries, but log the error
      res.json({ code: 0 });
    }
  });

  // Feishu card callback
  app.post('/webhook/feishu/card', async (req: Request, res: Response) => {
    try {
      if (!await verifyFeishuSignature(req)) {
        return res.status(403).json({ code: -1, msg: '签名验证失败' });
      }

      const action = req.body?.event?.action;
      if (!action) {
        return res.json({ code: 0 });
      }

      const cardAction: CardAction = {
        action: action.value?.action || action.action?.tag || '',
        channelCode: action.value?.channelCode || '',
        operator: { open_id: action.operator?.open_id || '' },
        formValue: action.form_value,
        chatId: action.value?.chatId || '',
        messageId: action.value?.messageId || '',
      };

      const result = await handleCardAction(cardAction);
      res.json(result || { code: 0 });
    } catch (err) {
      logger.error(`Card callback error: ${err instanceof Error ? err.stack : String(err)}`);
      res.json({ code: 0 });
    }
  });
}