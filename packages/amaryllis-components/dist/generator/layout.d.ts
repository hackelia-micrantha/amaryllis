export type ReactLayoutRuntime = 'nextjs' | 'web' | 'rn';
export interface LayoutValidationResult {
    layout?: string;
    error?: string;
}
export declare function validateAndNormalizeLayout(layout: string, runtime: ReactLayoutRuntime, slots?: readonly string[]): LayoutValidationResult;
