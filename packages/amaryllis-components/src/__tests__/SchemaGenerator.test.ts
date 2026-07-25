import { JSONSchemaGenerator } from '../generator/schema';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

describe('JSONSchemaGenerator', () => {
  it('preserves string bounds for props and matching slots', () => {
    const spec: ValidatedComponentSpec = {
      apiVersion: 'amaryllis/v1alpha1',
      kind: 'ComponentSpec',
      metadata: { name: 'summary-card', version: '0.1.0' },
      target: { framework: 'react', runtime: 'rn' },
      props: {
        type: 'object',
        properties: {
          summary: { type: 'string', maxLength: 240 },
        },
      },
      ui: {
        slots: ['summary'],
      },
      ai: {
        mode: 'personalize',
        execution: 'device',
        generationContract: { output: 'props-json' },
      },
    };

    const schema = JSON.parse(new JSONSchemaGenerator().generate(spec));

    expect(schema.properties.props.properties.summary).toEqual({
      type: 'string',
      maxLength: 240,
    });
    expect(schema.properties.slots.properties.summary).toEqual({
      type: 'string',
      maxLength: 240,
    });
  });
});
