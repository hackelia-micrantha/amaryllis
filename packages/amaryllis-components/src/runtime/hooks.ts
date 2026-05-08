import { useState, useMemo, useCallback } from 'react';
import { PersonalizationEngine } from './engine';
import { globalRegistry } from './registry';
import type {
  AgentUIInvocation,
  AgentUIOverlayResult,
} from '../integrations/agent-ui';

export interface UsePersonalizationOptions {
  name: string;
  baseProps?: Record<string, unknown>;
}

export function usePersonalization({
  name,
  baseProps = {},
}: UsePersonalizationOptions) {
  const engine = useMemo(() => new PersonalizationEngine(), []);
  const [personalizedProps, setPersonalizedProps] = useState(baseProps);
  const [error, setError] = useState<string[] | null>(null);

  const applyPersonalization = useCallback(
    (aiOutput: unknown) => {
      const registered = globalRegistry.get(name);
      if (!registered) {
        setError([`Component ${name} not registered`]);
        return;
      }

      const result = engine.validate(registered.contract, aiOutput);
      if (result.valid) {
        setPersonalizedProps(engine.apply(baseProps, result.data ?? {}));
        setError(null);
      } else {
        setError(result.errors || ['Unknown validation error']);
      }
    },
    [name, baseProps, engine]
  );

  const reset = useCallback(() => {
    setPersonalizedProps(baseProps);
    setError(null);
  }, [baseProps]);

  return {
    personalizedProps,
    error,
    applyPersonalization,
    reset,
  };
}

export interface AmaryllisPersonalizationActionOptions {
  componentName: string;
  baseProps?: Record<string, unknown>;
  infer: AmaryllisPersonalizationInfer;
}

export interface AmaryllisInferencePersonalizationActionOptions {
  componentName: string;
  baseProps?: Record<string, unknown>;
  generate: AmaryllisGenerateFunction;
}

export type AmaryllisPersonalizationInfer = (
  request: AgentUIInvocation
) => Promise<unknown>;

export interface AmaryllisInferenceRequest {
  prompt: string;
}

export type AmaryllisGenerateFunction = (
  request: AmaryllisInferenceRequest
) => Promise<unknown>;

export type AmaryllisPersonalizationAction = (
  request: Omit<AgentUIInvocation, 'componentName' | 'baseProps'> & {
    baseProps?: Record<string, unknown>;
  }
) => Promise<AgentUIOverlayResult>;

export function createAmaryllisInferenceAdapter(
  generate: AmaryllisGenerateFunction
): AmaryllisPersonalizationInfer {
  return async ({ prompt }) => {
    const output = await generate({ prompt });
    return parseAmaryllisInferenceOutput(output);
  };
}

export function createAmaryllisInferencePersonalizationAction({
  componentName,
  baseProps = {},
  generate,
}: AmaryllisInferencePersonalizationActionOptions): AmaryllisPersonalizationAction {
  return createAmaryllisPersonalizationAction({
    componentName,
    baseProps,
    infer: createAmaryllisInferenceAdapter(generate),
  });
}

export function createAmaryllisPersonalizationAction({
  componentName,
  baseProps = {},
  infer,
}: AmaryllisPersonalizationActionOptions): AmaryllisPersonalizationAction {
  const engine = new PersonalizationEngine();

  return async (request) => {
    const props = request.baseProps ?? baseProps;
    const registered = globalRegistry.get(componentName);

    if (!registered) {
      return {
        valid: false,
        props,
        errors: [`Component ${componentName} is not registered`],
      };
    }

    const rawOutput = await infer({
      componentName,
      baseProps: props,
      prompt: request.prompt,
      context: request.context,
    });

    const result = engine.validate(registered.contract, rawOutput);

    if (!result.valid) {
      return {
        valid: false,
        props,
        errors: result.errors ?? ['Unknown validation error'],
        rawOutput,
      };
    }

    return {
      valid: true,
      props: engine.apply(props, result.data ?? {}),
      rawOutput,
    };
  };
}

export function useAmaryllisPersonalizationAction(
  options: AmaryllisPersonalizationActionOptions
): AmaryllisPersonalizationAction {
  const { componentName, baseProps, infer } = options;

  return useMemo(
    () =>
      createAmaryllisPersonalizationAction({
        componentName,
        baseProps,
        infer,
      }),
    [componentName, baseProps, infer]
  );
}

function parseAmaryllisInferenceOutput(output: unknown): unknown {
  if (typeof output !== 'string') {
    return output;
  }

  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}
