import {
  validateContextPolicy,
  validateContextQuery,
  validateMediaPolicy,
  validateMediaReference,
  validateMediaReferences,
} from '../ContextValidation';
import type {
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
});
