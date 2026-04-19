import type { CardContent } from '../types';

export function buildDraftCard(channelCode: string, channelDisplayName: string, rawRecords: string, llmPreview: string, chatId: string): CardContent {
  return {
    title: `📋 当前交接草稿 - ${channelDisplayName}`,
    content: llmPreview || '_暂无 LLM 整理预览_',
    footer: `原始记录可折叠查看`,
    elements: [
      {
        tag: 'collapsible_panel',
        folded: true,
        elements: [
          { tag: 'markdown', content: rawRecords || '_暂无记录_' },
        ],
      },
      {
        tag: 'action',
        elements: [
          { tag: 'button', text: '保存修改', type: 'primary', value: { action: 'save', channelCode, chatId } },
          { tag: 'button', text: '重新整理', type: 'default', value: { action: 'regenerate', channelCode, chatId } },
          {
            tag: 'button', text: '发起交接', type: 'danger', value: { action: 'handover', channelCode, chatId },
            confirm: { title: '确认发起交接？', content: '接班人将收到交接通知' },
          },
        ],
      },
    ],
  };
}

export function buildHandoverCard(senderName: string, content: string, requireAccept: boolean): CardContent {
  if (requireAccept) {
    return {
      title: `交班：${senderName}`,
      content,
      footer: '接班人请回复：@自己 接班',
    };
  }
  return {
    title: `交接已归档：${senderName}`,
    content,
    footer: `交接时间：${new Date().toLocaleString()}`,
  };
}

export function buildCompletionCard(senderName: string, receiverName: string, content: string): CardContent {
  return {
    title: `交接完成：${senderName} → ${receiverName}`,
    content,
    footer: `交接时间：${new Date().toLocaleString()}`,
  };
}