import { useState, useMemo, useCallback } from 'react';
import { PersonalizationEngine } from './engine';
import { globalRegistry } from './registry';

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
