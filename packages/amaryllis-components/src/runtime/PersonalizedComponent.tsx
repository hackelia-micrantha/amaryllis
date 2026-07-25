import React, { useState, useEffect, useMemo } from 'react';
import {
  PersonalizationEngine,
  type PersonalizationDiagnostics,
} from './engine';
import { resolveUiPrimitives, type UiPrimitives } from './primitives';
import { useRegistry } from './registryContext';

export interface PersonalizedComponentValidationEvent {
  name: string;
  valid: boolean;
  errors?: string[];
  diagnostics?: PersonalizationDiagnostics;
}

export interface PersonalizedComponentProps {
  /** Name of the registered component to render */
  name: string;
  /** Base props to pass to the component */
  baseProps?: Record<string, unknown>;
  /** Optional structured AI output to apply (props, variants, slots) */
  personalizationData?: unknown;
  /** Loading state if the AI is still generating */
  loading?: boolean;
  /** Custom fallback if component is not found */
  fallback?: React.ReactNode;
  /** Optional UI primitive overrides for React Native or custom renderers */
  primitives?: Partial<UiPrimitives>;
  /** Optional validation callback for telemetry or diagnostics */
  onValidation?: (event: PersonalizedComponentValidationEvent) => void;
  /** Enable console warnings for validation failures. Defaults to false. */
  warnOnValidationFailure?: boolean;
}

/**
 * A wrapper component that handles on-device personalization.
 * It validates AI output against the component's contract before rendering.
 */
export const PersonalizedComponent: React.FC<PersonalizedComponentProps> = ({
  name,
  baseProps = {},
  personalizationData,
  loading,
  fallback,
  primitives,
  onValidation,
  warnOnValidationFailure = false,
}) => {
  const registry = useRegistry();
  const registered = registry.get(name);
  const engine = useMemo(() => new PersonalizationEngine(), []);
  const { View, Text } = useMemo(
    () => resolveUiPrimitives(primitives),
    [primitives]
  );

  const [finalProps, setFinalProps] = useState(baseProps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!registered) return;

    if (personalizationData) {
      const result = engine.validate(registered.contract, personalizationData);
      onValidation?.({
        name,
        valid: result.valid,
        errors: result.errors,
        diagnostics: result.diagnostics,
      });

      if (result.valid) {
        setFinalProps(engine.apply(baseProps, result.data ?? {}));
        setError(null);
      } else {
        if (warnOnValidationFailure) {
          console.warn(
            `Personalization validation failed for ${name}:`,
            result.errors
          );
        }
        setError('Invalid personalization data');
        // Revert to base props on failure
        setFinalProps(baseProps);
      }
    } else {
      setFinalProps(baseProps);
      setError(null);
    }
  }, [
    name,
    personalizationData,
    baseProps,
    registered,
    engine,
    onValidation,
    warnOnValidationFailure,
  ]);

  if (!registered) {
    return <>{fallback || null}</>;
  }

  const Component = registered.component;

  if (loading) {
    // Render with base props while loading, or could render a dedicated loader
    return <Component {...baseProps} _loading={true} />;
  }

  return (
    <View>
      <Component {...finalProps} />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = {
  errorText: {
    color: 'red',
    fontSize: 10,
  },
};
