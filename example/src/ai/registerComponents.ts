import {
  JSONSchemaGenerator,
  ComponentRegistry,
} from '@micrantha/amaryllis-components';
import type { ComponentType } from 'react';
import { ContextSummaryCard } from './ContextSummaryCard';
import { contextSummaryCardSpec } from './contextSummaryCardSpec';

const contract = JSON.parse(
  new JSONSchemaGenerator().generate(contextSummaryCardSpec)
);

export function registerExampleAiComponents(registry: ComponentRegistry): void {
  if (registry.get(contextSummaryCardSpec.metadata.name)) {
    return;
  }

  registry.register(contextSummaryCardSpec.metadata.name, {
    component: ContextSummaryCard as unknown as ComponentType<
      Record<string, unknown>
    >,
    spec: contextSummaryCardSpec,
    contract,
  });
}
