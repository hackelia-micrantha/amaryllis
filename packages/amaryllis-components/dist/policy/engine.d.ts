import type { ValidatedComponentSpec } from '../schema/spec.schema';
export type PolicyErrorCode = 'operation_conflict' | 'import_conflict' | 'device_contract_required' | 'device_structured_output_required' | 'device_executable_output_forbidden' | 'device_runtime_operation_forbidden' | 'device_runtime_policy_required' | 'executable_output_review_required';
export interface PolicyError {
    code: PolicyErrorCode;
    message: string;
}
export interface PolicyResult {
    valid: boolean;
    errors: string[];
    issues: PolicyError[];
}
export declare class PolicyEngine {
    validateSpec(spec: ValidatedComponentSpec): PolicyResult;
}
