import { describe, it, expect } from 'vitest';
import { buildDraftCard, buildHandoverCard, buildCompletionCard } from '../src/channels/feishu-card-builder';

describe('feishu-card-builder', () => {
  describe('buildDraftCard', () => {
    it('builds a draft card with raw records and preview', () => {
      const card = buildDraftCard('qiantai', '前台群', '10:00 张三: 测试', '整理后内容');
      expect(card.title).toContain('前台群');
      expect(card.content).toBe('整理后内容');
      expect(card.elements).toBeDefined();
      expect(card.elements!.length).toBeGreaterThan(0);
    });

    it('handles empty preview gracefully', () => {
      const card = buildDraftCard('qiantai', '前台群', '记录', '');
      expect(card.content).toContain('暂无');
    });
  });

  describe('buildHandoverCard', () => {
    it('builds require-accept card', () => {
      const card = buildHandoverCard('张三', '交接内容', true);
      expect(card.title).toContain('交班');
      expect(card.footer).toContain('接班');
    });

    it('builds auto-archive card', () => {
      const card = buildHandoverCard('张三', '交接内容', false);
      expect(card.title).toContain('归档');
    });
  });

  describe('buildCompletionCard', () => {
    it('builds completion card with both names', () => {
      const card = buildCompletionCard('张三', '李四', '交接内容');
      expect(card.title).toContain('张三');
      expect(card.title).toContain('李四');
      expect(card.title).toContain('完成');
    });
  });
});