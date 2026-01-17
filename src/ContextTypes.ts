import type { LlmRequestParams } from './Types';

export type EvictionStrategy = 'lru' | 'recency' | 'size';

export interface MediaReference {
  // Absolute path or URI depending on app policy.
  uri: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
}

export interface MediaValidationPolicy {
  // Require absolute URIs (recommended for security).
  requireAbsoluteUri?: boolean;
  // Whitelist of allowed URI schemes (e.g., ['file', 'content']).
  allowedUriSchemes?: string[];
  // Size and dimension limits for referenced media.
  maxMediaBytes?: number;
  maxMediaWidth?: number;
  maxMediaHeight?: number;
}

export interface ContextItem {
  id: string;
  text: string;
  metadata?: Record<string, string>;
  tags?: string[];
  media?: MediaReference[];
  createdAt: number;
  updatedAt?: number;
  ttlSeconds?: number;
}

export interface ContextQuery {
  text: string;
  limit?: number;
  filters?: Record<string, string>;
  tags?: string[];
  // 0..1 weighting for recency in scoring.
  recencyBias?: number;
  useSemantic?: boolean;
}

export interface ContextPolicy {
  maxBytes?: number;
  maxItems?: number;
  defaultTtlSeconds?: number;
  evictionStrategy?: EvictionStrategy;
  media?: MediaValidationPolicy;
}

export interface ContextStoreStats {
  itemCount: number;
  totalBytes?: number;
}

export interface ContextStore {
  put(items: ContextItem[]): Promise<void>;
  query(query: ContextQuery): Promise<ContextItem[]>;
  delete(ids: string[]): Promise<void>;
  compact(policy: ContextPolicy): Promise<void>;
  stats(): Promise<ContextStoreStats>;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimension?: number;
}

export interface ContextEngine {
  add(items: ContextItem[]): Promise<void>;
  search(query: ContextQuery): Promise<ContextItem[]>;
  setPolicy(policy: ContextPolicy): void;
  compact(): Promise<void>;
  formatRequest(params: ContextFormatParams): LlmRequestParams;
  deriveQuery(
    prompt: string,
    request: LlmRequestParams
  ): ContextQuery | undefined;
}

export interface ContextScorer {
  score(item: ContextItem, query: ContextQuery): number;
}

export interface ContextEngineOptions {
  store: ContextStore;
  scorer?: ContextScorer;
  policy?: ContextPolicy;
  formatter?: ContextRequestFormatter;
  defaultQueryFactory?: ContextDefaultQueryFactory;
}

export interface ContextFormatParams {
  prompt: string;
  items: ContextItem[];
  query?: ContextQuery;
  request: LlmRequestParams;
}

export type ContextRequestFormatter = (
  params: ContextFormatParams
) => LlmRequestParams;

export type ContextDefaultQueryFactory = (
  prompt: string,
  request: LlmRequestParams
) => ContextQuery | undefined;

export interface ToolDefinition {
  name: string;
  description?: string;
  // JSON schema or similar contract for tool input.
  inputSchema?: Record<string, unknown>;
}

export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  invoke(name: string, input: unknown): Promise<unknown>;
}
