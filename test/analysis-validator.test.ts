import { describe, it, expect } from 'vitest';
import { validateAnalysis } from '../src/services/analysis-validator';

describe('Analysis Validator', () => {
  it('passes valid analysis through', () => {
    const result = validateAnalysis(
      { category: '待办事项', content: '302房间加床', urgency: 'normal' },
      'original text'
    );
    expect(result).toEqual({ category: '待办事项', content: '302房间加床', urgency: 'normal' });
  });

  it('degrades invalid category to 未分类', () => {
    const result = validateAnalysis(
      { category: 'invalid_cat', content: 'test', urgency: 'normal' },
      'original'
    );
    expect(result.category).toBe('未分类');
    expect(result.content).toBe('test');
  });

  it('degrades invalid urgency to normal', () => {
    const result = validateAnalysis(
      { category: '待办事项', content: 'test', urgency: 'critical' },
      'original'
    );
    expect(result.urgency).toBe('normal');
  });

  it('degrades missing content to original text', () => {
    const result = validateAnalysis(
      { category: '待办事项', content: '', urgency: 'normal' },
      'original text'
    );
    expect(result.content).toBe('original text');
  });

  it('degrades non-object input to fallback', () => {
    const result = validateAnalysis(null, 'original text');
    expect(result).toEqual({ category: '未分类', content: 'original text', urgency: 'normal' });
  });

  it('degrades string input to fallback', () => {
    const result = validateAnalysis('not json', 'original text');
    expect(result).toEqual({ category: '未分类', content: 'original text', urgency: 'normal' });
  });

  it('handles all valid categories', () => {
    const categories = ['重要事项', '一般事项', '待办事项', '待跟进事项', '客房', '设备', '安全', '客户', '未分类'];
    for (const cat of categories) {
      const result = validateAnalysis({ category: cat, content: 'test', urgency: 'normal' }, 'fallback');
      expect(result.category).toBe(cat);
    }
  });

  it('handles all valid urgencies', () => {
    for (const urg of ['high', 'normal', 'low'] as const) {
      const result = validateAnalysis({ category: '未分类', content: 'test', urgency: urg }, 'fallback');
      expect(result.urgency).toBe(urg);
    }
  });
});