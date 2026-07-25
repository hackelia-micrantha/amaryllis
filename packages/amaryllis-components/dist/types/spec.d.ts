export type Stability = 'experimental' | 'stable' | 'deprecated';
export interface ComponentMetadata {
    name: string;
    version: string;
    owner?: string;
    stability?: Stability;
}
export interface ComponentTarget {
    framework: 'react';
    runtime: 'nextjs' | 'web' | 'rn';
    ssr?: boolean;
}
export type JsonSchemaPrimitiveType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
export interface JsonSchemaValue {
    type?: JsonSchemaPrimitiveType;
    description?: string;
    enum?: unknown[];
    default?: unknown;
    items?: JsonSchemaValue;
    properties?: Record<string, JsonSchemaValue>;
    required?: string[];
    additionalProperties?: boolean | JsonSchemaValue;
}
export interface ComponentProps {
    type: 'object';
    properties: Record<string, JsonSchemaValue>;
    required?: string[];
}
export interface ComponentUI {
    layout?: string;
    slots?: string[];
    variants?: Record<string, {
        layout?: string;
        props?: Record<string, unknown>;
    }>;
    designTokens?: {
        spacing?: string[];
        typography?: string[];
        colorRoles?: string[];
    };
    accessibility?: {
        rules?: string[];
    };
}
export interface ComponentBehavior {
    state?: Record<string, unknown>;
    events?: string[];
    sideEffects?: string[];
    constraints?: string[];
}
export type AIExecutionMode = 'scaffold' | 'customize' | 'personalize';
export type AIExecutionEnvironment = 'build' | 'ci' | 'device';
export interface ComponentAI {
    mode: AIExecutionMode;
    execution: AIExecutionEnvironment;
    allowedOperations?: string[];
    forbiddenOperations?: string[];
    generationContract?: {
        output: 'tsx' | 'props-json' | 'variant-selection' | 'json-patch';
        schemaRef?: string;
        styleSystem?: 'tailwind' | 'css-modules';
        constraints?: string[];
    };
    validators?: string[];
}
export interface ComponentPolicy {
    imports?: {
        allow?: string[];
        deny?: string[];
    };
    runtime?: {
        networkAccess?: 'restricted' | 'none';
        domAccess?: 'restricted' | 'none';
    };
    review?: {
        requireHumanApproval?: boolean;
    };
}
export interface ComponentSpec {
    apiVersion: string;
    kind: 'ComponentSpec';
    metadata: ComponentMetadata;
    target: ComponentTarget;
    props: ComponentProps;
    ui?: ComponentUI;
    behavior?: ComponentBehavior;
    ai: ComponentAI;
    policy?: ComponentPolicy;
}
