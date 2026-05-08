import type { AgentUIInvocation, AgentUIOverlayResult } from '../integrations/agent-ui';
export interface UsePersonalizationOptions {
    name: string;
    baseProps?: Record<string, unknown>;
}
export declare function usePersonalization({ name, baseProps, }: UsePersonalizationOptions): {
    personalizedProps: Record<string, unknown>;
    error: string[] | null;
    applyPersonalization: (aiOutput: unknown) => void;
    reset: () => void;
};
export interface AmaryllisPersonalizationActionOptions {
    componentName: string;
    baseProps?: Record<string, unknown>;
    infer: AmaryllisPersonalizationInfer;
    recovery?: AmaryllisPersonalizationRecoveryOptions;
}
export interface AmaryllisInferencePersonalizationActionOptions {
    componentName: string;
    baseProps?: Record<string, unknown>;
    generate: AmaryllisGenerateFunction;
    recovery?: AmaryllisPersonalizationRecoveryOptions;
}
export interface AmaryllisPersonalizationRecoveryOptions {
    maxAttempts: number;
}
export type AmaryllisPersonalizationInfer = (request: AgentUIInvocation) => Promise<unknown>;
export interface AmaryllisInferenceRequest {
    prompt: string;
}
export type AmaryllisGenerateFunction = (request: AmaryllisInferenceRequest) => Promise<unknown>;
export type AmaryllisPersonalizationAction = (request: Omit<AgentUIInvocation, 'componentName' | 'baseProps'> & {
    baseProps?: Record<string, unknown>;
}) => Promise<AgentUIOverlayResult>;
export declare function createAmaryllisInferenceAdapter(generate: AmaryllisGenerateFunction): AmaryllisPersonalizationInfer;
export declare function createAmaryllisInferencePersonalizationAction({ componentName, baseProps, generate, recovery, }: AmaryllisInferencePersonalizationActionOptions): AmaryllisPersonalizationAction;
export declare function createAmaryllisPersonalizationAction({ componentName, baseProps, infer, recovery, }: AmaryllisPersonalizationActionOptions): AmaryllisPersonalizationAction;
export declare function useAmaryllisPersonalizationAction(options: AmaryllisPersonalizationActionOptions): AmaryllisPersonalizationAction;
