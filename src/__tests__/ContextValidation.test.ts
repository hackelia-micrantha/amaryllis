import {
  validateContextItem,
  validateContextItems,
  validateContextPolicy,
  validateContextQuery,
  validateMediaPolicy,
  validateMediaReference,
  validateMediaReferences,
} from '../ContextValidation';
import type {
  ContextItem,
  ContextPolicy,
  ContextQuery,
  MediaReference,
  MediaValidationPolicy,
} from '../ContextTypes';
import { ValidationError } from '../Errors';

describe('ContextValidation', () => {
  describe('validateMediaPolicy', () => {
    it('should accept undefined policy', () => {
      expect(() => validateMediaPolicy(undefined)).not.toThrow();
    });

    it('should reject empty allowedUriSchemes', () => {
      const policy: MediaValidationPolicy = { allowedUriSchemes: [] };
      expect(() => validateMediaPolicy(policy)).toThrow(ValidationError);
    });

    it('should reject non-positive bounds', () => {
      const policy: MediaValidationPolicy = {
        maxMediaBytes: 0,
        maxMediaWidth: -1,
        maxMediaHeight: Number.NaN,
      };
      expect(() => validateMediaPolicy(policy)).toThrow(ValidationError);
    });
  });

  describe('validateContextPolicy', () => {
    it('should accept undefined policy', () => {
      expect(() => validateContextPolicy(undefined)).not.toThrow();
    });

    it('should reject invalid bounds', () => {
      const policy: ContextPolicy = {
        maxBytes: 0,
        maxItems: -1,
        defaultTtlSeconds: Number.NaN,
      };
      expect(() => validateContextPolicy(policy)).toThrow(ValidationError);
    });

    it('should reject unsupported eviction strategy', () => {
      const policy = { evictionStrategy: undefined } as ContextPolicy;
      expect(() => validateContextPolicy(policy)).toThrow(ValidationError);
    });
  });

  describe('validateMediaReference', () => {
    const baseRef: MediaReference = {
      uri: 'file:///tmp/test.png',
      sizeBytes: 128,
      width: 64,
      height: 64,
    };

    it('should accept valid reference without policy', () => {
      expect(() => validateMediaReference(baseRef)).not.toThrow();
    });

    it('should enforce absolute URI when required', () => {
      const policy: MediaValidationPolicy = { requireAbsoluteUri: true };
      const ref: MediaReference = { uri: 'relative/path.png' };
      expect(() => validateMediaReference(ref, policy)).toThrow(
        ValidationError
      );
    });

    it('should enforce allowed URI schemes', () => {
      const policy: MediaValidationPolicy = { allowedUriSchemes: ['content'] };
      expect(() => validateMediaReference(baseRef, policy)).toThrow(
        ValidationError
      );
    });

    it('should reject disallowed sizes', () => {
      const policy: MediaValidationPolicy = { maxMediaBytes: 64 };
      expect(() => validateMediaReference(baseRef, policy)).toThrow(
        ValidationError
      );
    });

    it('should reject non-positive media fields', () => {
      const ref: MediaReference = {
        uri: 'file:///tmp/test.png',
        sizeBytes: 0,
        width: -2,
        height: Number.NaN,
      };
      expect(() => validateMediaReference(ref)).toThrow(ValidationError);
    });
  });

  describe('validateMediaReferences', () => {
    it('should reject empty array', () => {
      expect(() => validateMediaReferences([])).toThrow(ValidationError);
    });

    it('should validate each reference', () => {
      const refs: MediaReference[] = [
        { uri: 'content://media/1', sizeBytes: 10 },
        { uri: 'content://media/2', sizeBytes: 20 },
      ];
      const policy: MediaValidationPolicy = { allowedUriSchemes: ['content'] };
      expect(() => validateMediaReferences(refs, policy)).not.toThrow();
    });
  });

  describe('validateContextQuery', () => {
    it('should reject empty query', () => {
      const query = { text: ' ' } as ContextQuery;
      expect(() => validateContextQuery(query)).toThrow(ValidationError);
    });

    it('should reject invalid limits', () => {
      const query = { text: 'hi', limit: 0 } as ContextQuery;
      expect(() => validateContextQuery(query)).toThrow(ValidationError);
    });

    it('should allow valid query', () => {
      const query: ContextQuery = { text: 'hi', limit: 2, recencyBias: 0.5 };
      expect(() => validateContextQuery(query)).not.toThrow();
    });
  });

  describe('untrusted JSON shapes', () => {
    const valid: ContextItem = {
      id: 'item',
      text: 'memory',
      createdAt: 1,
      tags: ['note'],
      metadata: { source: 'local' },
      media: [{ uri: 'file:///image.png', sizeBytes: 32 }],
    };

    it.each([
      { id: 42 },
      { text: null },
      { tags: 'note' },
      { tags: [null] },
      { tags: [] },
      { metadata: 'local' },
      { metadata: ['local'] },
      { metadata: { source: 42 } },
      { media: null },
      { media: {} },
      { media: [null] },
      { media: [{ uri: 42 }] },
      { media: [{ uri: 'file:///image', mimeType: false }] },
    ])('rejects malformed item fields: %j', (overrides) => {
      const item = { ...valid, ...overrides } as unknown as ContextItem;
      expect(() => validateContextItem(item)).toThrow(ValidationError);
    });

    it.each([null, 0, {}, 'items', [null]])(
      'rejects malformed item collections: %j',
      (input) => {
        expect(() =>
          validateContextItems(input as unknown as ContextItem[])
        ).toThrow(ValidationError);
      }
    );

    it.each([
      null,
      false,
      [],
      { media: { allowedUriSchemes: 'file' } },
      { media: { allowedUriSchemes: [null] } },
      { media: { requireAbsoluteUri: 'false' } },
    ])('rejects malformed policy shapes: %j', (input) => {
      expect(() =>
        validateContextPolicy(input as unknown as ContextPolicy)
      ).toThrow(ValidationError);
    });

    it.each([
      { text: 1 },
      { text: 'note', tags: 'note' },
      { text: 'note', filters: [] },
      { text: 'note', filters: { source: null } },
      { text: 'note', useSemantic: 'true' },
    ])('rejects malformed query shapes: %j', (input) => {
      expect(() =>
        validateContextQuery(input as unknown as ContextQuery)
      ).toThrow(ValidationError);
    });

    it('preserves a valid JSON round trip under configured media bounds', () => {
      const policy: ContextPolicy = {
        media: {
          allowedUriSchemes: ['file'],
          requireAbsoluteUri: true,
          maxMediaBytes: 32,
        },
      };
      const parsed: ContextItem = JSON.parse(JSON.stringify(valid));
      expect(() => validateContextItems([parsed], policy)).not.toThrow();
      expect(parsed).toEqual(valid);
    });
  });
});
