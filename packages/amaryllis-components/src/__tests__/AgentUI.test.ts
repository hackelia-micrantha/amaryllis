import type { ComponentType } from 'react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

import { JSONSchemaGenerator } from '../generator/schema';
import { createAgentUIToolContract } from '../integrations/agent-ui';
import {
  createAmaryllisInferenceAdapter,
  createAmaryllisInferencePersonalizationAction,
  createAmaryllisPersonalizationAction,
} from '../runtime/hooks';
import { registry } from './testRegistry';

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
    registry.register('summary-card', {
      component: Component,
      spec,
      contract,
    });
  });

  test('maps registered component to an AG-UI-shaped tool contract', () => {
    const entry = registry.get('summary-card');
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
      registry,
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

  test('adapts base Amaryllis inference to the action infer callback', async () => {
    const generateRequests: Array<{ prompt: string }> = [];
    const infer = createAmaryllisInferenceAdapter(async (request) => {
      generateRequests.push(request);
      return {
        props: { title: 'Adapted', count: 3 },
      };
    });

    const action = createAmaryllisPersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base', count: 0 },
      infer,
      registry,
    });

    const result = await action({
      prompt: 'summarize with the base runtime',
      context: { screen: 'quest-log' },
      baseProps: { title: 'Request Base', count: 1 },
    });

    expect(generateRequests).toEqual([
      { prompt: 'summarize with the base runtime' },
    ]);
    expect(result.valid).toBe(true);
    expect(result.props).toEqual({ title: 'Adapted', count: 3 });
  });

  test('bridges base Amaryllis inference directly to validated personalization props', async () => {
    const generateRequests: Array<{ prompt: string }> = [];
    const action = createAmaryllisInferencePersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base', count: 0 },
      generate: async (request) => {
        generateRequests.push(request);
        return JSON.stringify({
          props: { title: 'Generated JSON', count: 4 },
          variant: 'compact',
        });
      },
      registry,
    });

    const result = await action({
      prompt: 'personalize through the base runtime',
    });

    expect(generateRequests).toEqual([
      { prompt: 'personalize through the base runtime' },
    ]);
    expect(result.valid).toBe(true);
    expect(result.props).toEqual({
      title: 'Generated JSON',
      count: 4,
      variant: 'compact',
    });
  });

  test('invalid structured output returns errors and base props', async () => {
    const action = createAmaryllisPersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base', count: 0 },
      infer: async () => ({
        props: { title: 123 },
      }),
      registry,
    });

    const result = await action({ prompt: 'bad output' });

    expect(result.valid).toBe(false);
    expect(result.props).toEqual({ title: 'Base', count: 0 });
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.rawOutput).toEqual({ props: { title: 123 } });
  });

  test('does not retry invalid output when recovery is not configured', async () => {
    const infer = jest.fn(async () => ({
      props: { title: 123 },
    }));
    const action = createAmaryllisPersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base', count: 0 },
      infer,
      registry,
    });

    const result = await action({ prompt: 'bad output' });

    expect(infer).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(false);
    expect(result.props).toEqual({ title: 'Base', count: 0 });
  });

  test('recovers invalid output with one bounded validation retry', async () => {
    const infer = jest
      .fn()
      .mockResolvedValueOnce({ props: { title: 123 } })
      .mockImplementationOnce(async (request) => {
        expect(request.recovery?.attempt).toBe(1);
        expect(request.recovery?.validationErrors.length).toBeGreaterThan(0);
        expect(request.recovery?.rawOutput).toEqual({ props: { title: 123 } });
        return { props: { title: 'Recovered', count: 5 } };
      });
    const action = createAmaryllisPersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base', count: 0 },
      infer,
      recovery: { maxAttempts: 1 },
      registry,
    });

    const result = await action({ prompt: 'recover output' });

    expect(infer).toHaveBeenCalledTimes(2);
    expect(result.valid).toBe(true);
    expect(result.props).toEqual({ title: 'Recovered', count: 5 });
  });

  test('raw TSX-like output fails schema validation', async () => {
    const action = createAmaryllisPersonalizationAction({
      componentName: 'summary-card',
      baseProps: { title: 'Base' },
      infer: async () => '<SummaryCard title="Unsafe" />',
      registry,
    });

    const result = await action({ prompt: 'write jsx' });

    expect(result.valid).toBe(false);
    expect(result.props).toEqual({ title: 'Base' });
    expect(result.errors?.join('\n')).toContain('must be object');
  });
});
