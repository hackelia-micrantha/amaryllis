import type { ValidatedComponentSpec } from '../schema/spec.schema';
export declare class JSONSchemaGenerator {
    generate(spec: ValidatedComponentSpec): string;
    private mapProperties;
}
