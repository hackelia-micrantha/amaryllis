import { PolicyEngine } from '../policy/engine';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

describe('PolicyEngine', () => {
  const engine = new PolicyEngine();

  it('should detect conflicting operations', () => {
    const spec: any = {
      ai: {
        allowedOperations: ['test'],
        forbiddenOperations: ['test'],
      },
    };
    const result = engine.validateSpec(spec as ValidatedComponentSpec);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Operation 'test' is both allowed and forbidden."
    );
  });

  it('should pass valid policy', () => {
    const spec: any = {
      ai: {
        allowedOperations: ['op1'],
        forbiddenOperations: ['op2'],
      },
      policy: {
        imports: {
          allow: ['react'],
          deny: ['fs'],
        },
      },
    };
    const result = engine.validateSpec(spec as ValidatedComponentSpec);
    expect(result.valid).toBe(true);
  });
});
