import { PolicyEngine } from '../policy/engine';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

describe('PolicyEngine', () => {
  const engine = new PolicyEngine();

  it('should detect conflicting operations', () => {
    const spec = {
      ai: {
        allowedOperations: ['test'],
        forbiddenOperations: ['test'],
      },
    };
    const result = engine.validateSpec(
      spec as unknown as ValidatedComponentSpec
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Operation 'test' is both allowed and forbidden."
    );
    expect(result.issues).toContainEqual({
      code: 'operation_conflict',
      message: "Operation 'test' is both allowed and forbidden.",
    });
  });

  it('should pass valid policy', () => {
    const spec = {
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
    const result = engine.validateSpec(
      spec as unknown as ValidatedComponentSpec
    );
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('should require human approval for executable generation', () => {
    const spec = {
      ai: {
        mode: 'scaffold',
        execution: 'build',
        generationContract: {
          output: 'tsx',
        },
      },
      policy: {
        review: {
          requireHumanApproval: false,
        },
      },
    };

    const result = engine.validateSpec(
      spec as unknown as ValidatedComponentSpec
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Executable generated output requires human approval.'
    );
    expect(result.issues.map((issue) => issue.code)).toContain(
      'executable_output_review_required'
    );
  });

  it('should reject forbidden runtime operations on device', () => {
    const spec = {
      ai: {
        mode: 'personalize',
        execution: 'device',
        allowedOperations: ['setSlotText', 'executeCode'],
        generationContract: {
          output: 'props-json',
        },
      },
      policy: {
        runtime: {
          networkAccess: 'none',
          domAccess: 'none',
        },
      },
    };

    const result = engine.validateSpec(
      spec as unknown as ValidatedComponentSpec
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Runtime operation 'executeCode' is forbidden on device."
    );
    expect(result.issues.map((issue) => issue.code)).toContain(
      'device_runtime_operation_forbidden'
    );
  });

  it('should require explicit runtime policy for device execution', () => {
    const spec = {
      ai: {
        mode: 'personalize',
        execution: 'device',
        generationContract: {
          output: 'props-json',
        },
      },
      policy: {
        runtime: {
          networkAccess: 'none',
        },
      },
    };

    const result = engine.validateSpec(
      spec as unknown as ValidatedComponentSpec
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Device execution must declare runtime.domAccess as restricted or none.'
    );
    expect(result.issues.map((issue) => issue.code)).toContain(
      'device_runtime_policy_required'
    );
  });

  it('should allow structured device personalization with explicit runtime policy', () => {
    const spec = {
      ai: {
        mode: 'personalize',
        execution: 'device',
        allowedOperations: ['setSlotText'],
        generationContract: {
          output: 'json-patch',
        },
      },
      policy: {
        runtime: {
          networkAccess: 'none',
          domAccess: 'restricted',
        },
      },
    };

    const result = engine.validateSpec(
      spec as unknown as ValidatedComponentSpec
    );
    expect(result.valid).toBe(true);
  });
});
