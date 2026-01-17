import { defaultContextScorer, DEFAULT_RECENCY_BIAS } from '../ContextPolicies';
import type { ContextItem, ContextQuery } from '../ContextTypes';

describe('ContextPolicies', () => {
  describe('defaultContextScorer', () => {
    const now = 1_700_000_000_000;
    const baseItem: ContextItem = {
      id: 'item-1',
      text: 'alpha beta',
      createdAt: now - 1000,
    };

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(now);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should prefer keyword matches with low recency bias', () => {
      const query: ContextQuery = {
        text: 'alpha',
        recencyBias: 0,
      };
      const score = defaultContextScorer.score(baseItem, query);
      expect(score).toBeGreaterThan(0);
    });

    it('should clamp recency bias above 1', () => {
      const query: ContextQuery = {
        text: 'missing',
        recencyBias: 2,
      };
      const score = defaultContextScorer.score(baseItem, query);
      expect(score).toBeGreaterThan(0);
    });

    it('should clamp recency bias below 0', () => {
      const query: ContextQuery = {
        text: 'alpha',
        recencyBias: -1,
      };
      const score = defaultContextScorer.score(baseItem, query);
      expect(score).toBeCloseTo(1, 3);
    });

    it('should use default bias when none provided', () => {
      const query: ContextQuery = { text: 'alpha' };
      const score = defaultContextScorer.score(baseItem, query);
      expect(score).toBeGreaterThan(0);
      expect(DEFAULT_RECENCY_BIAS).toBeGreaterThan(0);
    });

    it('should reduce recency score for older items', () => {
      const olderItem: ContextItem = {
        ...baseItem,
        createdAt: now - 1000 * 60 * 60 * 24,
      };
      const query: ContextQuery = { text: 'alpha', recencyBias: 1 };
      const recentScore = defaultContextScorer.score(baseItem, query);
      const oldScore = defaultContextScorer.score(olderItem, query);
      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });
});
