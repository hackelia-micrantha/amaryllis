import { ReactGenerator } from '../generator/react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

describe('ReactGenerator', () => {
  const generator = new ReactGenerator();

  it('should generate a React component', () => {
    const spec: any = {
      metadata: { name: 'my-button', version: '1.0.0' },
      props: {
        type: 'object',
        properties: {
          label: { type: 'string' },
        },
        required: ['label'],
      },
      target: { runtime: 'web' },
      ai: { mode: 'scaffold', execution: 'build' },
    };

    const code = generator.generate(spec as ValidatedComponentSpec);
    expect(code).toContain('export const MyButton');
    expect(code).toContain('label: string');
  });
});
