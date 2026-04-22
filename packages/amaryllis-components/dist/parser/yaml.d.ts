import { type ValidatedComponentSpec } from '../schema/spec.schema';
export declare function parseComponentSpec(
  content: string
): ValidatedComponentSpec;
export declare function stringifyComponentSpec(
  spec: ValidatedComponentSpec
): string;
