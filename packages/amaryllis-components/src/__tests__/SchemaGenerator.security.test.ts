import { JSONSchemaGenerator } from '../generator/schema';
import { PersonalizationEngine } from '../runtime/engine';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

describe('JSONSchemaGenerator security boundaries', () => {
  const generator = new JSONSchemaGenerator();
  const engine = new PersonalizationEngine();

  const propsJsonSpec: ValidatedComponentSpec = {
    apiVersion: 'amaryllis/v1alpha1',
    kind: 'ComponentSpec',
    metadata: { name: 'summary-card', version: '0.1.0' },
    target: { framework: 'react', runtime: 'rn' },
    props: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string', maxLength: 240 },
      },
      required: ['title'],
    },
    ui: {
      slots: ['summary'],
    },
    ai: {
      mode: 'personalize',
      execution: 'device',
      allowedOperations: ['setSlotText'],
      generationContract: { output: 'props-json' },
    },
  };

  test('propagates summary length constraints to props and matching slots', () => {
    const contract = JSON.parse(generator.generate(propsJsonSpec));

    expect(contract.properties.props.properties.summary.maxLength).toBe(240);
    expect(contract.properties.slots.properties.summary.maxLength).toBe(240);

    const overlongSummary = 'x'.repeat(241);
    expect(
      engine.validate(contract, {
        props: { title: 'Title', summary: overlongSummary },
      }).valid
    ).toBe(false);
    expect(
      engine.validate(contract, {
        props: { title: 'Title' },
        slots: { summary: overlongSummary },
      }).valid
    ).toBe(false);
  });

  test('omits patches unless the generation contract explicitly selects json-patch', () => {
    const propsContract = JSON.parse(generator.generate(propsJsonSpec));

    expect(propsContract.properties.patches).toBeUndefined();
    expect(
      engine.validate(propsContract, {
        props: { title: 'Title' },
        patches: [{ op: 'replace', path: '/props/title', value: 'Changed' }],
      }).valid
    ).toBe(false);

    const patchSpec: ValidatedComponentSpec = {
      ...propsJsonSpec,
      metadata: { name: 'patch-card', version: '0.1.0' },
      ai: {
        ...propsJsonSpec.ai,
        generationContract: { output: 'json-patch' },
      },
    };
    const patchContract = JSON.parse(generator.generate(patchSpec));

    expect(patchContract.properties.patches).toBeDefined();
  });
});
