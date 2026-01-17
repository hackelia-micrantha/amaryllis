import type {
  ContextEngine as ContextEngineContract,
  ContextEngineOptions,
  ContextFormatParams,
  ContextItem,
  ContextQuery,
  ContextScorer,
  ContextDefaultQueryFactory,
  ContextRequestFormatter,
} from './ContextTypes';
import type { LlmRequestParams } from './Types';
import { defaultContextScorer } from './ContextPolicies';
import {
  validateContextItems,
  validateContextPolicy,
  validateContextQuery,
} from './ContextValidation';

const formatMetadata = (metadata: ContextItem['metadata']): string | null => {
  if (!metadata) {
    return null;
  }
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return null;
  }
  const pairs = entries.map(([key, value]) => `${key}=${value}`);
  return `meta=${pairs.join(', ')}`;
};

const formatTags = (tags: ContextItem['tags']): string | null => {
  if (!tags || tags.length === 0) {
    return null;
  }
  return `tags=${tags.join(', ')}`;
};

const formatContextItem = (item: ContextItem): string => {
  const parts = [
    item.text.trim(),
    formatTags(item.tags),
    formatMetadata(item.metadata),
  ];
  return parts
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(' | ');
};

export const defaultContextFormatter: ContextRequestFormatter = (
  params: ContextFormatParams
) => {
  if (params.items.length === 0) {
    return params.request;
  }
  const lines = params.items.map((item) => `- ${formatContextItem(item)}`);
  const contextBlock = ['Context:', ...lines].join('\n');
  const augmentedPrompt = [contextBlock, params.prompt]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .join('\n\n');
  return {
    ...params.request,
    prompt: augmentedPrompt,
  };
};

export class ContextEngine implements ContextEngineContract {
  private readonly store: ContextEngineOptions['store'];
  private readonly scorer: ContextScorer;
  private policy: ContextEngineOptions['policy'];
  private readonly formatter: ContextRequestFormatter;
  private readonly defaultQueryFactory?: ContextDefaultQueryFactory;

  constructor(options: ContextEngineOptions) {
    validateContextPolicy(options.policy);
    this.store = options.store;
    this.scorer = options.scorer ?? defaultContextScorer;
    this.policy = options.policy ?? {};
    this.formatter = options.formatter ?? defaultContextFormatter;
    this.defaultQueryFactory = options.defaultQueryFactory;
  }

  async add(items: ContextItem[]): Promise<void> {
    validateContextItems(items, this.policy);
    await this.store.put(items);
  }

  async search(query: ContextQuery): Promise<ContextItem[]> {
    validateContextQuery(query);
    const results = await this.store.query(query);
    if (results.length <= 1) {
      return results;
    }
    const scored = results.map((item, index) => ({
      item,
      index,
      score: this.scorer.score(item, query),
    }));
    scored.sort((a, b) => {
      if (a.score === b.score) {
        return a.index - b.index;
      }
      return b.score - a.score;
    });
    return scored.map((entry) => entry.item);
  }

  setPolicy(policy: ContextEngineOptions['policy']): void {
    validateContextPolicy(policy);
    this.policy = policy ?? {};
  }

  async compact(): Promise<void> {
    await this.store.compact(this.policy ?? {});
  }

  formatRequest(params: ContextFormatParams): LlmRequestParams {
    return this.formatter(params);
  }

  deriveQuery(
    prompt: string,
    request: LlmRequestParams
  ): ContextQuery | undefined {
    return this.defaultQueryFactory?.(prompt, request);
  }
}

export const createContextEngine = (
  options: ContextEngineOptions
): ContextEngineContract => {
  return new ContextEngine(options);
};
