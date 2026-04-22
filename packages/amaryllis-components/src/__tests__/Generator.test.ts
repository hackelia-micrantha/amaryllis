import { ReactGenerator } from '../generator/react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

describe('ReactGenerator', () => {
  const generator = new ReactGenerator();

  it('should generate a React component', () => {
    const spec: ValidatedComponentSpec = {
      apiVersion: 'amaryllis/v1alpha1',
      kind: 'ComponentSpec',
      metadata: { name: 'my-button', version: '1.0.0' },
      props: {
        type: 'object',
        properties: {
          label: { type: 'string' },
        },
        required: ['label'],
      },
      target: { framework: 'react', runtime: 'web' },
      ai: { mode: 'scaffold', execution: 'build' },
    };

    const code = generator.generate(spec, {
      specHash: 'sha256-test',
      modelId: 'test-model',
      promptVersion: 'prompt-v1',
      validationSummary: 'test-validation',
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(code).toContain('export const MyButton');
    expect(code).toContain('label: string');
    expect(code).toContain('Spec Hash: sha256-test');
    expect(code).toContain('Model: test-model');
    expect(code).toContain('Prompt Version: prompt-v1');
    expect(code).toContain('Validation: test-validation');
  });
});
