import type { ValidatedComponentSpec } from '../schema/spec.schema';
export interface ReactGeneratorOptions {
    specHash?: string;
    modelId?: string;
    promptVersion?: string;
    validationSummary?: string;
    generatedAt?: Date;
}
export declare class ReactGenerator {
    generate(spec: ValidatedComponentSpec, options?: ReactGeneratorOptions): string;
    private generateVariantLogic;
    private toPascalCase;
    private generatePropsType;
    private generateDesignTokensType;
    private generateDesignTokenGroupType;
    private jsonSchemaToTsType;
    private generateImports;
    private getDefaultLayout;
    private wrapWithLayout;
    private generateProvenance;
}
