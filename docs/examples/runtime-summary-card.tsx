import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import {
  PersonalizedComponent,
  RegistryProvider,
  type ComponentRegistry,
  type PersonalizationContract,
  type PersonalizedComponentValidationEvent,
  type ValidatedComponentSpec,
} from '@micrantha/amaryllis-components';

interface SummaryCardProps extends Record<string, unknown> {
  title?: string;
  summary?: string;
  variant?: 'compact' | 'expanded';
}

function SummaryCard({ title, summary, variant }: SummaryCardProps) {
  return (
    <View accessibilityRole="summary">
      <Text>{title}</Text>
      <Text>{summary}</Text>
      <Text>{variant}</Text>
    </View>
  );
}

export interface RuntimeSummaryCardExampleProps {
  spec: ValidatedComponentSpec;
  contract: PersonalizationContract;
  personalizationData: unknown;
}

export function RuntimeSummaryCardExample({
  spec,
  contract,
  personalizationData,
}: RuntimeSummaryCardExampleProps) {
  const register = useCallback(
    (registry: ComponentRegistry) => {
      registry.register('SummaryCard', {
        component: SummaryCard,
        spec,
        contract,
        implementationIdentity: 'docs/examples/SummaryCard',
      });
    },
    [contract, spec]
  );

  const recordValidation = useCallback(
    ({ valid, diagnostics }: PersonalizedComponentValidationEvent) => {
      // Record only coarse validation diagnostics by default. Do not log raw
      // prompts, user input, or model output without an explicit data policy.
      console.info('SummaryCard personalization', {
        valid,
        errorCount: diagnostics?.errorCount ?? 0,
      });
    },
    []
  );

  return (
    <RegistryProvider initialize={register}>
      <PersonalizedComponent
        name="SummaryCard"
        baseProps={{
          title: 'Base title',
          summary: 'Base summary',
          variant: 'expanded',
        }}
        personalizationData={personalizationData}
        onValidation={recordValidation}
      />
    </RegistryProvider>
  );
}

// Pass summary-card.personalization.valid.json to render validated overlay
// props. Pass summary-card.personalization.invalid.json to observe rejection
// and deterministic rendering with the unchanged baseProps above.
