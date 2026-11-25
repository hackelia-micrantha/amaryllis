import { type ValidatedComponentSpec } from '../schema/spec.schema';
/**
 * Every candidate must pass the canonical schema and policy checks immediately
 * before reaching a generator. A validated base spec does not validate a patch.
 */
export declare function validateSpecForGeneration(candidate: unknown): ValidatedComponentSpec;
/**
 * Apply only well-formed JSON Patch operations to a clone of the validated base.
 * The resulting document is untrusted until it passes both validations again.
 */
export declare function applyCustomizationAndValidate(base: ValidatedComponentSpec, patch: unknown): ValidatedComponentSpec;
