import type { ValidatedComponentSpec } from '../schema/spec.schema';
export declare class ReactGenerator {
  generate(spec: ValidatedComponentSpec): string;
  private toPascalCase;
  private generatePropsType;
  private jsonSchemaToTsType;
  private generateImports;
  private wrapWithLayout;
}
