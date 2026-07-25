import {
  JSONSchemaGenerator,
  ComponentRegistry,
} from '@micrantha/amaryllis-components';
import type { ComponentType } from 'react';
import { ContextSummaryCard } from './ContextSummaryCard';
import { contextSummaryCardSpec } from './contextSummaryCardSpec';
import { PersonaProfileCard } from './PersonaProfileCard';
import { personaProfileCardSpec } from './personaProfileCardSpec';

const contextSummaryCardContract = JSON.parse(
  new JSONSchemaGenerator().generate(contextSummaryCardSpec)
);
const personaProfileCardContract = JSON.parse(
  new JSONSchemaGenerator().generate(personaProfileCardSpec)
);

export function registerExampleAiComponents(registry: ComponentRegistry): void {
  if (!registry.get(contextSummaryCardSpec.metadata.name)) {
    registry.register(contextSummaryCardSpec.metadata.name, {
      component: ContextSummaryCard as unknown as ComponentType<
        Record<string, unknown>
      >,
      spec: contextSummaryCardSpec,
      contract: contextSummaryCardContract,
    });
  }

  if (!registry.get(personaProfileCardSpec.metadata.name)) {
    registry.register(personaProfileCardSpec.metadata.name, {
      component: PersonaProfileCard as unknown as ComponentType<
        Record<string, unknown>
      >,
      spec: personaProfileCardSpec,
      contract: personaProfileCardContract,
    });
  }
}
