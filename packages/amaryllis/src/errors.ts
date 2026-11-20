export class AmaryllisError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AmaryllisError';
  }
}

export class ValidationError extends AmaryllisError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/** An application-owned ContextStore cannot honor a configured invariant. */
export class ContextPolicyUnsupportedError extends AmaryllisError {
  constructor(message: string) {
    super(message, 'CONTEXT_POLICY_UNSUPPORTED');
    this.name = 'ContextPolicyUnsupportedError';
  }
}
