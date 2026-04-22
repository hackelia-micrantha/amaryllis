import type { ValidatedComponentSpec } from '../schema/spec.schema';
export interface PolicyResult {
    valid: boolean;
    errors: string[];
}
export declare class PolicyEngine {
    validateSpec(spec: ValidatedComponentSpec): PolicyResult;
}
