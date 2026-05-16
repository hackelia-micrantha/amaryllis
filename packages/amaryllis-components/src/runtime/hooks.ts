import { useState, useMemo, useCallback } from 'react';
import { PersonalizationEngine } from './engine';
import type {
  AgentUIInvocation,
  AgentUIOverlayResult,
} from '../integrations/agent-ui';
import { useRegistry } from './registryContext';

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
  const registry = useRegistry();

  const applyPersonalization = useCallback(
    (aiOutput: unknown) => {
      const registered = registry.get(name);
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
    [registry, name, engine, baseProps]
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
  registry: ReturnType<typeof useRegistry>;
  baseProps?: Record<string, unknown>;
  infer: AmaryllisPersonalizationInfer;
  recovery?: AmaryllisPersonalizationRecoveryOptions;
}

export interface AmaryllisInferencePersonalizationActionOptions {
  componentName: string;
  registry: ReturnType<typeof useRegistry>;
  baseProps?: Record<string, unknown>;
  generate: AmaryllisGenerateFunction;
  recovery?: AmaryllisPersonalizationRecoveryOptions;
}

export interface AmaryllisPersonalizationRecoveryOptions {
  maxAttempts: number;
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
  recovery,
  registry,
}: AmaryllisInferencePersonalizationActionOptions): AmaryllisPersonalizationAction {
  return createAmaryllisPersonalizationAction({
    componentName,
    baseProps,
    infer: createAmaryllisInferenceAdapter(generate),
    recovery,
    registry,
  });
}

export function createAmaryllisPersonalizationAction({
  componentName,
  baseProps = {},
  infer,
  recovery,
  registry,
}: AmaryllisPersonalizationActionOptions): AmaryllisPersonalizationAction {
  const engine = new PersonalizationEngine();
  const maxRecoveryAttempts = Math.max(0, recovery?.maxAttempts ?? 0);

  return async (request) => {
    const props = request.baseProps ?? baseProps;
    const registered = registry.get(componentName);

    if (!registered) {
      return {
        valid: false,
        props,
        errors: [`Component ${componentName} is not registered`],
      };
    }

    let rawOutput = await infer({
      componentName,
      baseProps: props,
      prompt: request.prompt,
      context: request.context,
    });

    let result = engine.validate(registered.contract, rawOutput);

    for (
      let attempt = 1;
      !result.valid && attempt <= maxRecoveryAttempts;
      attempt++
    ) {
      rawOutput = await infer({
        componentName,
        baseProps: props,
        prompt: request.prompt,
        context: request.context,
        recovery: {
          attempt,
          validationErrors: result.errors ?? ['Unknown validation error'],
          rawOutput,
        },
      });

      result = engine.validate(registered.contract, rawOutput);
    }

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
  const { componentName, baseProps, infer, recovery } = options;
  const registry = useRegistry();

  return useMemo(
    () =>
      createAmaryllisPersonalizationAction({
        componentName,
        baseProps,
        infer,
        recovery,
        registry,
      }),
    [componentName, baseProps, infer, recovery, registry]
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
