import React, { useEffect, useMemo } from 'react';
import {
  PersonalizationEngine,
  type PersonalizationDiagnostics,
} from './engine';
import { resolveUiPrimitives, type UiPrimitives } from './primitives';
import { useRegistry } from './registryContext';

const EMPTY_PROPS: Record<string, unknown> = Object.freeze({});

export interface PersonalizedComponentValidationEvent {
  name: string;
  valid: boolean;
  errors?: string[];
  diagnostics?: PersonalizationDiagnostics;
}

export interface PersonalizedComponentProps {
  /** Exact name@SemVer identity of the registered component to render */
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
  baseProps = EMPTY_PROPS,
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

  // Derived render state must be computed from current inputs, not restored in
  // a passive effect after a previous component/audience has already rendered.
  const validation = useMemo(() => {
    if (!registered || !personalizationData) return null;
    return engine.validate(registered.contract, personalizationData);
  }, [registered, personalizationData, engine]);

  const finalProps = useMemo(() => {
    if (!validation?.valid) return baseProps;
    return engine.apply(baseProps, validation.data ?? {});
  }, [baseProps, validation, engine]);

  const error =
    validation && !validation.valid ? 'Invalid personalization data' : null;

  useEffect(() => {
    if (!validation) return;
    onValidation?.({
      name,
      valid: validation.valid,
      errors: validation.errors,
      diagnostics: validation.diagnostics,
    });

    if (!validation.valid && warnOnValidationFailure) {
      console.warn(
        `Personalization validation failed for ${name}:`,
        validation.errors
      );
    }
  }, [name, validation, onValidation, warnOnValidationFailure]);

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
