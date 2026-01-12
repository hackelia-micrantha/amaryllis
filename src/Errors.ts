export class AmaryllisError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AmaryllisError';
  }
}

export class InitializationError extends AmaryllisError {
  constructor(message: string) {
    super(message, 'INIT_ERROR');
    this.name = 'InitializationError';
  }
}

export class GenerationError extends AmaryllisError {
  constructor(message: string) {
    super(message, 'GENERATION_ERROR');
    this.name = 'GenerationError';
  }
}

export class SessionError extends AmaryllisError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR');
    this.name = 'SessionError';
  }
}

export class ValidationError extends AmaryllisError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ResourceError extends AmaryllisError {
  constructor(message: string) {
    super(message, 'RESOURCE_ERROR');
    this.name = 'ResourceError';
  }
}

export function isAmaryllisError(error: unknown): error is AmaryllisError {
  return error instanceof AmaryllisError;
}

export function createError(
  message: string,
  code: string = 'UNKNOWN_ERROR'
): AmaryllisError {
  return new AmaryllisError(message, code);
}
