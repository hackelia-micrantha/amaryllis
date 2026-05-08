import type { RegisteredComponent } from '../runtime/registry';
export interface AgentUIInvocation {
    componentName: string;
    baseProps?: Record<string, unknown>;
    prompt: string;
    context?: Record<string, unknown>;
    recovery?: {
        attempt: number;
        validationErrors: string[];
        rawOutput: unknown;
    };
}
export interface AgentUIOverlayResult {
    valid: boolean;
    props: Record<string, unknown>;
    errors?: string[];
    rawOutput?: unknown;
}
export interface AgentUIToolContract {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    component: {
        name: string;
        version: string;
        contract: Record<string, unknown>;
    };
}
export interface AgentUIAdapter {
    createToolContract(componentName: string, entry: RegisteredComponent): AgentUIToolContract;
}
export declare function createAgentUIToolContract(componentName: string, entry?: RegisteredComponent): AgentUIToolContract;
export declare const agentUIAdapter: AgentUIAdapter;
