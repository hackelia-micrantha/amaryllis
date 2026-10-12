import * as jsonpatch from 'fast-json-patch';
import { PolicyEngine } from '../policy/engine';
import {
  ComponentSpecSchema,
  type ValidatedComponentSpec,
} from '../schema/spec.schema';

/**
 * Every candidate must pass the canonical schema and policy checks immediately
 * before reaching a generator. A validated base spec does not validate a patch.
 */
export function validateSpecForGeneration(
  candidate: unknown
): ValidatedComponentSpec {
  const spec = ComponentSpecSchema.parse(candidate);
  const result = new PolicyEngine().validateSpec(spec);
  if (!result.valid) {
    throw new Error(`Component policy validation failed: ${result.errors.join('; ')}`);
  }
  return spec;
}

/**
 * Apply only well-formed JSON Patch operations to a clone of the validated base.
 * The resulting document is untrusted until it passes both validations again.
 */
export function applyCustomizationAndValidate(
  base: ValidatedComponentSpec,
  patch: unknown
): ValidatedComponentSpec {
  if (!Array.isArray(patch)) {
    throw new Error('Customization patch must be an array of JSON Patch operations');
  }

  const result = jsonpatch.applyPatch(
    base,
    patch as jsonpatch.Operation[],
    true, // validate operations and paths
    false, // do not mutate the validated base document
    true // reject prototype-modifying operations
  );

  return validateSpecForGeneration(result.newDocument);
}
