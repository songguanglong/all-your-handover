import type { AnalyzeResult } from '../types';

const VALID_CATEGORIES = [
  '重要事项', '一般事项', '待办事项', '待跟进事项',
  '客房', '设备', '安全', '客户', '未分类',
];

const VALID_URGENCIES: AnalyzeResult['urgency'][] = ['high', 'normal', 'low'];

const FALLBACK_CATEGORY = '未分类';
const FALLBACK_URGENCY: AnalyzeResult['urgency'] = 'normal';

/** Validate and degrade an LLM analysis result */
export function validateAnalysis(raw: unknown, originalText: string): AnalyzeResult {
  if (!raw || typeof raw !== 'object') {
    return { category: FALLBACK_CATEGORY, content: originalText, urgency: FALLBACK_URGENCY };
  }

  const obj = raw as Record<string, unknown>;

  const category = typeof obj.category === 'string' && VALID_CATEGORIES.includes(obj.category)
    ? obj.category
    : FALLBACK_CATEGORY;

  const urgency = typeof obj.urgency === 'string' && VALID_URGENCIES.includes(obj.urgency as AnalyzeResult['urgency'])
    ? obj.urgency as AnalyzeResult['urgency']
    : FALLBACK_URGENCY;

  const content = typeof obj.content === 'string' && obj.content.trim()
    ? obj.content.trim()
    : originalText;

  return { category, content, urgency };
}

/** Validate an array of analysis items */
export function validateAnalysisArray(items: unknown[], originalTexts: Map<string, string>): AnalyzeResult[] {
  return items.map(item => {
    const fallbackText = (item as Record<string, unknown>)?.msgId
      ? originalTexts.get(String((item as Record<string, unknown>).msgId)) ?? ''
      : '';
    return validateAnalysis(item, fallbackText);
  });
}