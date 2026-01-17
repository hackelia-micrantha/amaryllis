import type {
  ContextItem,
  ContextPolicy,
  ContextQuery,
  MediaReference,
  MediaValidationPolicy,
} from './ContextTypes';
import { ValidationError } from './Errors';

const SCHEME_REGEX = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

const isAbsolutePath = (uri: string): boolean => {
  return uri.startsWith('/') || /^[a-zA-Z]:\\\\/.test(uri);
};

const getScheme = (uri: string): string | undefined => {
  const match = uri.match(SCHEME_REGEX);
  return match?.[1]?.toLowerCase();
};

const isPositiveNumber = (value: number | undefined): value is number => {
  return value !== undefined && Number.isFinite(value) && value > 0;
};

const isNonEmptyString = (value: string | undefined): value is string => {
  return value !== undefined && value.trim().length > 0;
};

const assertNonEmpty = (value: string, field: string): void => {
  if (!isNonEmptyString(value)) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
};

const validateStringList = (values: string[], field: string): void => {
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
  if (!policy) {
    return;
  }

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
  if (!policy) {
    return;
  }

  const { allowedUriSchemes, maxMediaBytes, maxMediaWidth, maxMediaHeight } =
    policy;

  if (allowedUriSchemes) {
    if (allowedUriSchemes.length === 0) {
      throw new ValidationError('allowedUriSchemes must not be empty');
    }
    for (const scheme of allowedUriSchemes) {
      assertNonEmpty(scheme, 'allowedUriSchemes item');
    }
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
  assertNonEmpty(reference.uri, 'MediaReference.uri');

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
  if (!references) {
    return;
  }
  if (references.length === 0) {
    throw new ValidationError('media must not be an empty array');
  }
  validateMediaPolicy(policy);
  for (const reference of references) {
    validateMediaReference(reference, policy);
  }
};

export const validateContextItem = (
  item: ContextItem,
  policy?: ContextPolicy
): void => {
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

  if (item.tags) {
    validateStringList(item.tags, 'ContextItem.tags');
  }

  if (item.metadata) {
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
  if (items.length === 0) {
    throw new ValidationError('items must not be empty');
  }
  validateContextPolicy(policy);
  for (const item of items) {
    validateContextItem(item, policy);
  }
};

export const validateContextQuery = (query: ContextQuery): void => {
  assertNonEmpty(query.text, 'ContextQuery.text');

  if (query.limit !== undefined && !isPositiveNumber(query.limit)) {
    throw new ValidationError('ContextQuery.limit must be a positive number');
  }
  if (query.recencyBias !== undefined && !Number.isFinite(query.recencyBias)) {
    throw new ValidationError(
      'ContextQuery.recencyBias must be a finite number'
    );
  }
  if (query.tags) {
    validateStringList(query.tags, 'ContextQuery.tags');
  }
  if (query.filters) {
    const entries = Object.entries(query.filters);
    for (const [key, value] of entries) {
      assertNonEmpty(key, 'ContextQuery.filters key');
      assertNonEmpty(value, 'ContextQuery.filters value');
    }
  }
};
