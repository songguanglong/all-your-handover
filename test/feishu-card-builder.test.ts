import { describe, it, expect } from 'vitest';
import { buildHandoverCard, buildCompletionCard } from '../src/channels/feishu-card-builder';

describe('feishu-card-builder', () => {
  describe('buildHandoverCard', () => {
    it('builds require-accept card with H5 link', () => {
      const card = buildHandoverCard('张三', '交接内容', true, 'qiantai');
      expect(card.title).toContain('交班');
      expect(card.footer).toContain('qiantai');
    });

    it('builds require-accept card without H5 link', () => {
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