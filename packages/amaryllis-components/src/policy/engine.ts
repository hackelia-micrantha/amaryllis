import type { ValidatedComponentSpec } from '../schema/spec.schema';

export type PolicyErrorCode =
  | 'operation_conflict'
  | 'import_conflict'
  | 'device_contract_required'
  | 'device_structured_output_required'
  | 'device_executable_output_forbidden'
  | 'device_runtime_operation_forbidden'
  | 'device_runtime_policy_required'
  | 'executable_output_review_required';

export interface PolicyError {
  code: PolicyErrorCode;
  message: string;
}

export interface PolicyResult {
  valid: boolean;
  errors: string[];
  issues: PolicyError[];
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
  'domAccess',
  'unrestrictedNetworkAccess',
]);

export class PolicyEngine {
  validateSpec(spec: ValidatedComponentSpec): PolicyResult {
    const issues: PolicyError[] = [];
    const addIssue = (code: PolicyErrorCode, message: string): void => {
      issues.push({ code, message });
    };

    if (spec.ai.forbiddenOperations && spec.ai.allowedOperations) {
      for (const op of spec.ai.allowedOperations) {
        if (spec.ai.forbiddenOperations.includes(op)) {
          addIssue(
            'operation_conflict',
            `Operation '${op}' is both allowed and forbidden.`
          );
        }
      }
    }

    if (spec.policy?.imports) {
      const { allow, deny } = spec.policy.imports;
      if (allow && deny) {
        for (const item of allow) {
          if (deny.includes(item)) {
            addIssue(
              'import_conflict',
              `Import '${item}' is both allowed and denied.`
            );
          }
        }
      }
    }

    const output = spec.ai.generationContract?.output;

    if (spec.ai.execution === 'device') {
      if (!spec.ai.generationContract) {
        addIssue(
          'device_contract_required',
          'Device execution requires a generation contract.'
        );
      } else if (!STRUCTURED_DEVICE_OUTPUTS.has(output ?? '')) {
        addIssue(
          'device_structured_output_required',
          'Device execution must output structured data only.'
        );
      }

      if (output && EXECUTABLE_OUTPUTS.has(output)) {
        addIssue(
          'device_executable_output_forbidden',
          'Device execution cannot output TSX or executable code.'
        );
      }

      for (const op of spec.ai.allowedOperations ?? []) {
        if (FORBIDDEN_RUNTIME_OPERATIONS.has(op)) {
          addIssue(
            'device_runtime_operation_forbidden',
            `Runtime operation '${op}' is forbidden on device.`
          );
        }
      }

      if (!spec.policy?.runtime?.networkAccess) {
        addIssue(
          'device_runtime_policy_required',
          'Device execution must declare runtime.networkAccess as restricted or none.'
        );
      }

      if (!spec.policy?.runtime?.domAccess) {
        addIssue(
          'device_runtime_policy_required',
          'Device execution must declare runtime.domAccess as restricted or none.'
        );
      }
    }

    if (output && EXECUTABLE_OUTPUTS.has(output)) {
      if (spec.ai.execution === 'device') {
        addIssue(
          'device_executable_output_forbidden',
          'Executable generated output is limited to build or CI.'
        );
      }

      if (spec.policy?.review?.requireHumanApproval !== true) {
        addIssue(
          'executable_output_review_required',
          'Executable generated output requires human approval.'
        );
      }
    }

    return {
      valid: issues.length === 0,
      errors: issues.map((issue) => issue.message),
      issues,
    };
  }
}
