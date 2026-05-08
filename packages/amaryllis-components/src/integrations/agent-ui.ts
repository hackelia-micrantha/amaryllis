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
  createToolContract(
    componentName: string,
    entry: RegisteredComponent
  ): AgentUIToolContract;
}

export function createAgentUIToolContract(
  componentName: string,
  entry?: RegisteredComponent
): AgentUIToolContract {
  if (!entry) {
    throw new Error(`Component ${componentName} is not registered.`);
  }

  const { spec, contract } = entry;
  const name = spec.metadata.name;
  const version = spec.metadata.version;

  return {
    name: `amaryllis.personalize.${name}`,
    description:
      `Personalize ${name}@${version} with structured output only. ` +
      'Do not return JSX, TSX, JavaScript, imports, or raw markup.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        context: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    component: {
      name,
      version,
      contract,
    },
  };
}

export const agentUIAdapter: AgentUIAdapter = {
  createToolContract: createAgentUIToolContract,
};
