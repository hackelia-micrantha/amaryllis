import type { ContextItem, ContextQuery, ContextScorer } from './ContextTypes';

export const DEFAULT_RECENCY_BIAS = 0.35;

const clamp01 = (value: number): number => {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/\\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const keywordScore = (item: ContextItem, query: ContextQuery): number => {
  const queryTokens = tokenize(query.text);
  if (queryTokens.length === 0) {
    return 0;
  }
  const haystack = item.text.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      hits += 1;
    }
  }
  return hits / queryTokens.length;
};

const recencyScore = (item: ContextItem): number => {
  const ageMs = Date.now() - item.createdAt;
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 0;
  }
  const ageHours = ageMs / (1000 * 60 * 60);
  return 1 / (1 + ageHours);
};

export const defaultContextScorer: ContextScorer = {
  score: (item: ContextItem, query: ContextQuery): number => {
    const bias = clamp01(query.recencyBias ?? DEFAULT_RECENCY_BIAS);
    const recency = recencyScore(item);
    const keyword = keywordScore(item, query);
    return bias * recency + (1 - bias) * keyword;
  },
};
