import {
  AmaryllisError,
  InitializationError,
  GenerationError,
  SessionError,
  ValidationError,
  ResourceError,
  isAmaryllisError,
  createError,
} from '../Errors';

describe('Errors', () => {
  describe('AmaryllisError', () => {
    it('should create AmaryllisError with message and code', () => {
      const error = new AmaryllisError('Test message', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AmaryllisError);
      expect(error.name).toBe('AmaryllisError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
    });

    it('should maintain prototype chain for instanceof checks', () => {
      const error = new AmaryllisError('Test', 'TEST');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AmaryllisError).toBe(true);
      expect(error.constructor.name).toBe('AmaryllisError');
    });
  });

  describe('Specific error types', () => {
    it('should create InitializationError with correct code', () => {
      const error = new InitializationError('Init failed');
      expect(error.code).toBe('INIT_ERROR');
      expect(error.name).toBe('InitializationError');
    });

    it('should create GenerationError with correct code', () => {
      const error = new GenerationError('Generation failed');
      expect(error.code).toBe('GENERATION_ERROR');
      expect(error.name).toBe('GenerationError');
    });

    it('should create SessionError with correct code', () => {
      const error = new SessionError('Session failed');
      expect(error.code).toBe('SESSION_ERROR');
      expect(error.name).toBe('SessionError');
    });

    it('should create ValidationError with correct code', () => {
      const error = new ValidationError('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });

    it('should create ResourceError with correct code', () => {
      const error = new ResourceError('Resource exhausted');
      expect(error.code).toBe('RESOURCE_ERROR');
      expect(error.name).toBe('ResourceError');
    });
  });

  describe('isAmaryllisError', () => {
    it('should return true for AmaryllisError instances', () => {
      const error = new AmaryllisError('Test', 'TEST');
      expect(isAmaryllisError(error)).toBe(true);
    });

    it('should return true for subclass instances', () => {
      expect(isAmaryllisError(new InitializationError('test'))).toBe(true);
      expect(isAmaryllisError(new GenerationError('test'))).toBe(true);
      expect(isAmaryllisError(new SessionError('test'))).toBe(true);
      expect(isAmaryllisError(new ValidationError('test'))).toBe(true);
      expect(isAmaryllisError(new ResourceError('test'))).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isAmaryllisError(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(isAmaryllisError('string')).toBe(false);
      expect(isAmaryllisError(123)).toBe(false);
      expect(isAmaryllisError({})).toBe(false);
      expect(isAmaryllisError(null)).toBe(false);
      expect(isAmaryllisError(undefined)).toBe(false);
    });
  });

  describe('createError', () => {
    it('should create AmaryllisError with message and custom code', () => {
      const error = createError('Custom error', 'CUSTOM_CODE');

      expect(error).toBeInstanceOf(AmaryllisError);
      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should create AmaryllisError with default code when none provided', () => {
      const error = createError('Default error');

      expect(error).toBeInstanceOf(AmaryllisError);
      expect(error.message).toBe('Default error');
      expect(error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Error handling patterns', () => {
    it('should work correctly in try-catch with type guards', () => {
      const throwError = () => {
        throw new GenerationError('Test generation error');
      };

      try {
        throwError();
        fail('Should have thrown error');
      } catch (e: unknown) {
        if (isAmaryllisError(e)) {
          expect(e.code).toBe('GENERATION_ERROR');
          expect(e.message).toBe('Test generation error');
        } else {
          fail('Should be AmaryllisError');
        }
      }
    });

    it('should handle unknown errors correctly', () => {
      const unknownError: unknown = new Error('Unknown');

      const amaryllisError = isAmaryllisError(unknownError)
        ? unknownError
        : new InitializationError(
            (unknownError as Error)?.message || 'Failed to initialize'
          );

      expect(amaryllisError).toBeInstanceOf(AmaryllisError);
      expect(amaryllisError.code).toBe('INIT_ERROR');
    });
  });

  describe('Edge cases', () => {
    it('should handle extremely long messages', () => {
      const longMessage = 'x'.repeat(10000);
      const error = new AmaryllisError(longMessage, 'LONG');

      expect(error.message).toBe(longMessage);
      expect(error.code).toBe('LONG');
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Error with \n\r\t"\'\\ chars and emojis 🚀🔥';
      const error = new AmaryllisError(specialMessage, 'SPECIAL');

      expect(error.message).toBe(specialMessage);
      expect(error.code).toBe('SPECIAL');
    });

    it('should handle empty strings', () => {
      const error = new AmaryllisError('', 'EMPTY');

      expect(error.message).toBe('');
      expect(error.code).toBe('EMPTY');
    });
  });
});
