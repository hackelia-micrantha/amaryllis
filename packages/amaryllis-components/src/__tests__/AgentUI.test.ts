import type { ComponentType } from 'react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

import { JSONSchemaGenerator } from '../generator/schema';
import { createAgentUIToolContract } from '../integrations/agent-ui';
import { createAmaryllisPersonalizationAction } from '../runtime/hooks';
import { globalRegistry } from '../runtime/registry';

describe('Agent UI integration', () => {
  const spec: ValidatedComponentSpec = {
    apiVersion: 'amaryllis/v1alpha1',
    kind: 'ComponentSpec',
    metadata: { name: 'summary-card', version: '1.0.0' },
    target: { framework: 'react', runtime: 'rn' },
    props: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['title'],
    },
    ui: {
      slots: ['summary'],
      variants: {
        compact: { layout: '<div>{title}</div>' },
      },
    },
    ai: {
      mode: 'personalize',
      execution: 'device',
      generationContract: {
        output: 'props-json',
      },
    },
    policy: {
      runtime: {
        networkAccess: 'none',
      },
    },
  };

  const contract = JSON.parse(new JSONSchemaGenerator().generate(spec));
  const Component = (() => null) as ComponentType<Record<string, unknown>>;

  beforeAll(() => {
    globalRegistry.register('summary-card', {
      component: Component,
      spec,
      contract,
    });
  });

  test('maps registered component to an AG-UI-shaped tool contract', () => {
    const entry = globalRegistry.get('summary-card');
    const tool = createAgentUIToolContract('summary-card', entry);

    expect(tool.name).toBe('amaryllis.personalize.summary-card');
    expect(tool.description).toContain('structured output only');
    expect(tool.parameters).toMatchObject({
      type: 'object',
      required: ['prompt'],
    });
    expect(tool.component).toEqual({
      name: 'summary-card',
      version: '1.0.0',
      contract,
    });
  });

  test('rejects missing registry entry when creating a tool contract', () => {
    expect(() => createAgentUIToolContract('missing-card')).toThrow(
      'Component missing-card is not registered.'
    );
  });

  test('valid structured output updates props through the action bridge', async () => {
    const action = createAmaryllisPersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base', count: 0 },
      infer: async (request) => {
        expect(request.componentName).toBe('summary-card');
        expect(request.prompt).toBe('summarize locally');
        return {
          props: { title: 'Personalized', count: 2 },
          variant: 'compact',
          slots: { summary: 'Local summary' },
        };
      },
    });

    const result = await action({ prompt: 'summarize locally' });

    expect(result.valid).toBe(true);
    expect(result.props).toEqual({
      title: 'Personalized',
      count: 2,
      variant: 'compact',
      summary: 'Local summary',
    });
  });

  test('invalid structured output returns errors and base props', async () => {
    const action = createAmaryllisPersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base', count: 0 },
      infer: async () => ({
        props: { title: 123 },
      }),
    });

    const result = await action({ prompt: 'bad output' });

    expect(result.valid).toBe(false);
    expect(result.props).toEqual({ title: 'Base', count: 0 });
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.rawOutput).toEqual({ props: { title: 123 } });
  });

  test('raw TSX-like output fails schema validation', async () => {
    const action = createAmaryllisPersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base' },
      infer: async () => '<SummaryCard title="Unsafe" />',
    });

    const result = await action({ prompt: 'write jsx' });

    expect(result.valid).toBe(false);
    expect(result.props).toEqual({ title: 'Base' });
    expect(result.errors?.join('\n')).toContain('must be object');
  });
});
