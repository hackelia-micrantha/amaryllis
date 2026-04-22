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

export interface ComponentProps {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface ComponentUI {
  layout?: string;
  slots?: string[];
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
  state?: Record<string, any>;
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
