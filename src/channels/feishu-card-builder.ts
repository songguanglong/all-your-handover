import type { CardContent } from '../types';

function getH5BaseUrl(): string {
  return process.env.H5_BASE_URL || '';
}

export function buildHandoverCard(senderName: string, content: string, requireAccept: boolean, channelCode?: string): CardContent {
  const h5Url = channelCode ? `${getH5BaseUrl()}/h5/draft/${channelCode}` : '';

  if (requireAccept) {
    return {
      title: `交班：${senderName}`,
      content,
      footer: h5Url ? `接班人请点击查看：${h5Url}` : '接班人请回复：@自己 接班',
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