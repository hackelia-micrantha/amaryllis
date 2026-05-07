import type { ValidatedComponentSpec } from '../schema/spec.schema';

export interface PolicyResult {
  valid: boolean;
  errors: string[];
}

const EXECUTABLE_OUTPUTS = new Set(['tsx']);
const STRUCTURED_DEVICE_OUTPUTS = new Set([
  'props-json',
  'variant-selection',
  'json-patch',
]);
const FORBIDDEN_RUNTIME_OPERATIONS = new Set([
  'addImport',
  'executeCode',
  'rawMarkup',
  'networkAccess',
  'nativeModuleAccess',
]);

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

    // 2. Import policy
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

    const output = spec.ai.generationContract?.output;

    if (spec.ai.execution === 'device') {
      if (!spec.ai.generationContract) {
        errors.push('Device execution requires a generation contract.');
      } else if (!STRUCTURED_DEVICE_OUTPUTS.has(output ?? '')) {
        errors.push('Device execution must output structured data only.');
      }

      if (output && EXECUTABLE_OUTPUTS.has(output)) {
        errors.push('Device execution cannot output TSX or executable code.');
      }

      for (const op of spec.ai.allowedOperations ?? []) {
        if (FORBIDDEN_RUNTIME_OPERATIONS.has(op)) {
          errors.push(`Runtime operation '${op}' is forbidden on device.`);
        }
      }

      if (!spec.policy?.runtime?.networkAccess) {
        errors.push(
          'Device execution must declare runtime.networkAccess as restricted or none.'
        );
      }
    }

    if (output && EXECUTABLE_OUTPUTS.has(output)) {
      if (spec.ai.execution === 'device') {
        errors.push('Executable generated output is limited to build or CI.');
      }

      if (spec.policy?.review?.requireHumanApproval !== true) {
        errors.push('Executable generated output requires human approval.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
