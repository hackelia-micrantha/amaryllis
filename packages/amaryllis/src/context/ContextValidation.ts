import type {
  ContextItem,
  ContextPolicy,
  ContextQuery,
  MediaReference,
  MediaValidationPolicy,
} from './ContextTypes';
import { ValidationError } from '../errors';

const SCHEME_REGEX = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

const isAbsolutePath = (uri: string): boolean => {
  return uri.startsWith('/') || /^[a-zA-Z]:\\/.test(uri);
};

const getScheme = (uri: string): string | undefined => {
  const match = uri.match(SCHEME_REGEX);
  return match?.[1]?.toLowerCase();
};

const isPositiveNumber = (value: number | undefined): value is number => {
  return value !== undefined && Number.isFinite(value) && value > 0;
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const assertRecord = (value: unknown, field: string): void => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ValidationError(`${field} must be a plain object`);
  }
};

const assertNonEmpty = (value: string, field: string): void => {
  if (!isNonEmptyString(value)) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
};

const validateStringList = (values: string[], field: string): void => {
  if (!Array.isArray(values)) {
    throw new ValidationError(`${field} must be an array`);
  }
  if (values.length === 0) {
    throw new ValidationError(`${field} must not be empty`);
  }
  for (const value of values) {
    assertNonEmpty(value, field);
  }
};

export const validateContextPolicy = (
  policy: ContextPolicy | undefined
): void => {
  if (policy === undefined) {
    return;
  }
  assertRecord(policy, 'ContextPolicy');

  const { maxBytes, maxItems, defaultTtlSeconds, evictionStrategy, media } =
    policy;

  if (maxBytes !== undefined && !isPositiveNumber(maxBytes)) {
    throw new ValidationError('maxBytes must be a positive number');
  }
  if (maxItems !== undefined && !isPositiveNumber(maxItems)) {
    throw new ValidationError('maxItems must be a positive number');
  }
  if (defaultTtlSeconds !== undefined && !isPositiveNumber(defaultTtlSeconds)) {
    throw new ValidationError('defaultTtlSeconds must be a positive number');
  }
  const hasEvictionStrategy = Object.prototype.hasOwnProperty.call(
    policy,
    'evictionStrategy'
  );
  if (hasEvictionStrategy && evictionStrategy === undefined) {
    throw new ValidationError('evictionStrategy is not supported');
  }
  if (
    evictionStrategy !== undefined &&
    evictionStrategy !== 'lru' &&
    evictionStrategy !== 'recency' &&
    evictionStrategy !== 'size'
  ) {
    throw new ValidationError('evictionStrategy is not supported');
  }

  validateMediaPolicy(media);
};

export const validateMediaPolicy = (
  policy: MediaValidationPolicy | undefined
): void => {
  if (policy === undefined) {
    return;
  }
  assertRecord(policy, 'MediaValidationPolicy');
  if (
    policy.requireAbsoluteUri !== undefined &&
    typeof policy.requireAbsoluteUri !== 'boolean'
  ) {
    throw new ValidationError('requireAbsoluteUri must be a boolean');
  }

  const { allowedUriSchemes, maxMediaBytes, maxMediaWidth, maxMediaHeight } =
    policy;

  if (allowedUriSchemes !== undefined) {
    validateStringList(allowedUriSchemes, 'allowedUriSchemes');
  }

  if (maxMediaBytes !== undefined && !isPositiveNumber(maxMediaBytes)) {
    throw new ValidationError('maxMediaBytes must be a positive number');
  }
  if (maxMediaWidth !== undefined && !isPositiveNumber(maxMediaWidth)) {
    throw new ValidationError('maxMediaWidth must be a positive number');
  }
  if (maxMediaHeight !== undefined && !isPositiveNumber(maxMediaHeight)) {
    throw new ValidationError('maxMediaHeight must be a positive number');
  }
};

export const validateMediaReference = (
  reference: MediaReference,
  policy?: MediaValidationPolicy
): void => {
  assertRecord(reference, 'MediaReference');
  assertNonEmpty(reference.uri, 'MediaReference.uri');
  if (
    reference.mimeType !== undefined &&
    typeof reference.mimeType !== 'string'
  ) {
    throw new ValidationError('MediaReference.mimeType must be a string');
  }
  validateMediaPolicy(policy);

  if (policy?.requireAbsoluteUri) {
    const scheme = getScheme(reference.uri);
    if (!scheme && !isAbsolutePath(reference.uri)) {
      throw new ValidationError(
        'MediaReference.uri must be an absolute path or URI'
      );
    }
  }

  if (policy?.allowedUriSchemes) {
    const scheme = getScheme(reference.uri);
    if (!scheme) {
      throw new ValidationError(
        'MediaReference.uri must include a scheme when allowedUriSchemes is set'
      );
    }
    const allowed = policy.allowedUriSchemes.map((item) => item.toLowerCase());
    if (!allowed.includes(scheme)) {
      throw new ValidationError(
        `MediaReference.uri scheme not allowed: ${scheme}`
      );
    }
  }

  if (
    reference.sizeBytes !== undefined &&
    !isPositiveNumber(reference.sizeBytes)
  ) {
    throw new ValidationError(
      'MediaReference.sizeBytes must be a positive number'
    );
  }
  if (reference.width !== undefined && !isPositiveNumber(reference.width)) {
    throw new ValidationError('MediaReference.width must be a positive number');
  }
  if (reference.height !== undefined && !isPositiveNumber(reference.height)) {
    throw new ValidationError(
      'MediaReference.height must be a positive number'
    );
  }

  if (
    policy?.maxMediaBytes !== undefined &&
    reference.sizeBytes !== undefined &&
    reference.sizeBytes > policy.maxMediaBytes
  ) {
    throw new ValidationError(
      'MediaReference.sizeBytes exceeds policy maxMediaBytes'
    );
  }
  if (
    policy?.maxMediaWidth !== undefined &&
    reference.width !== undefined &&
    reference.width > policy.maxMediaWidth
  ) {
    throw new ValidationError(
      'MediaReference.width exceeds policy maxMediaWidth'
    );
  }
  if (
    policy?.maxMediaHeight !== undefined &&
    reference.height !== undefined &&
    reference.height > policy.maxMediaHeight
  ) {
    throw new ValidationError(
      'MediaReference.height exceeds policy maxMediaHeight'
    );
  }
};

export const validateMediaReferences = (
  references: MediaReference[] | undefined,
  policy?: MediaValidationPolicy
): void => {
  if (references === undefined) {
    return;
  }
  if (!Array.isArray(references)) {
    throw new ValidationError('media must be an array');
  }
  if (references.length === 0) {
    throw new ValidationError('media must not be an empty array');
  }
  for (const reference of references) {
    validateMediaReference(reference, policy);
  }
};

export const validateContextItem = (
  item: ContextItem,
  policy?: ContextPolicy
): void => {
  assertRecord(item, 'ContextItem');
  assertNonEmpty(item.id, 'ContextItem.id');
  assertNonEmpty(item.text, 'ContextItem.text');

  if (!Number.isFinite(item.createdAt) || item.createdAt <= 0) {
    throw new ValidationError(
      'ContextItem.createdAt must be a positive number'
    );
  }
  if (
    item.updatedAt !== undefined &&
    (!Number.isFinite(item.updatedAt) || item.updatedAt <= 0)
  ) {
    throw new ValidationError(
      'ContextItem.updatedAt must be a positive number'
    );
  }
  if (item.ttlSeconds !== undefined && !isPositiveNumber(item.ttlSeconds)) {
    throw new ValidationError(
      'ContextItem.ttlSeconds must be a positive number'
    );
  }

  if (item.tags !== undefined) {
    validateStringList(item.tags, 'ContextItem.tags');
  }

  if (item.metadata !== undefined) {
    assertRecord(item.metadata, 'ContextItem.metadata');
    const entries = Object.entries(item.metadata);
    for (const [key, value] of entries) {
      assertNonEmpty(key, 'ContextItem.metadata key');
      assertNonEmpty(value, 'ContextItem.metadata value');
    }
  }

  validateMediaReferences(item.media, policy?.media);
};

export const validateContextItems = (
  items: ContextItem[],
  policy?: ContextPolicy
): void => {
  if (!Array.isArray(items)) {
    throw new ValidationError('items must be an array');
  }
  if (items.length === 0) {
    throw new ValidationError('items must not be empty');
  }
  validateContextPolicy(policy);
  for (const item of items) {
    validateContextItem(item, policy);
  }
};

export const validateContextQuery = (query: ContextQuery): void => {
  assertRecord(query, 'ContextQuery');
  assertNonEmpty(query.text, 'ContextQuery.text');
  if (
    query.useSemantic !== undefined &&
    typeof query.useSemantic !== 'boolean'
  ) {
    throw new ValidationError('ContextQuery.useSemantic must be a boolean');
  }

  if (query.limit !== undefined && !isPositiveNumber(query.limit)) {
    throw new ValidationError('ContextQuery.limit must be a positive number');
  }
  if (query.recencyBias !== undefined && !Number.isFinite(query.recencyBias)) {
    throw new ValidationError(
      'ContextQuery.recencyBias must be a finite number'
    );
  }
  if (query.tags !== undefined) {
    validateStringList(query.tags, 'ContextQuery.tags');
  }
  if (query.filters !== undefined) {
    assertRecord(query.filters, 'ContextQuery.filters');
    const entries = Object.entries(query.filters);
    for (const [key, value] of entries) {
      assertNonEmpty(key, 'ContextQuery.filters key');
      assertNonEmpty(value, 'ContextQuery.filters value');
    }
  }
};
