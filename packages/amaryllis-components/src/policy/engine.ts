import type { ValidatedComponentSpec } from '../schema/spec.schema';

export interface PolicyResult {
  valid: boolean;
  errors: string[];
}

export class PolicyEngine {
  validateSpec(spec: ValidatedComponentSpec): PolicyResult {
    const errors: string[] = [];

    // 1. Check forbidden operations
    if (spec.ai.forbiddenOperations && spec.ai.allowedOperations) {
      for (const op of spec.ai.allowedOperations) {
        if (spec.ai.forbiddenOperations.includes(op)) {
          errors.push(`Operation '${op}' is both allowed and forbidden.`);
        }
      }
    }

    // 2. Import policy (placeholder for code generation phase)
    // In Phase 1, we just check if the policy exists
    if (spec.policy?.imports) {
      const { allow, deny } = spec.policy.imports;
      if (allow && deny) {
        for (const item of allow) {
          if (deny.includes(item)) {
            errors.push(`Import '${item}' is both allowed and denied.`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
