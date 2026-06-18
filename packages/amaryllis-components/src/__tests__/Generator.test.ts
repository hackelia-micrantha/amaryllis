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
      generatorVersion: 'test-generator',
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(code).toContain('export const MyButton');
    expect(code).toContain('label: string');
    expect(code).toContain('Spec Hash: sha256-test');
    expect(code).toContain('Generator Version: test-generator');
    expect(code).toContain('Model: test-model');
    expect(code).toContain('Prompt Version: prompt-v1');
    expect(code).toContain('Validation: test-validation');
    expect(code).toContain('Generated At: 2026-01-01T00:00:00.000Z');
  });

  it('should not inject wall-clock time when generatedAt is omitted', () => {
    const spec: ValidatedComponentSpec = {
      apiVersion: 'amaryllis/v1alpha1',
      kind: 'ComponentSpec',
      metadata: { name: 'stable-card', version: '1.0.0' },
      props: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
      },
      target: { framework: 'react', runtime: 'web' },
      ai: { mode: 'scaffold', execution: 'build' },
    };

    const code = generator.generate(spec);
    expect(code).toContain('Generated At: unavailable');
  });

  it('should generate richer TypeScript from enums, arrays, integers, and objects', () => {
    const spec: ValidatedComponentSpec = {
      apiVersion: 'amaryllis/v1alpha1',
      kind: 'ComponentSpec',
      metadata: { name: 'typed-card', version: '1.0.0' },
      props: {
        type: 'object',
        properties: {
          tone: { type: 'string', enum: ['info', 'warning'] },
          count: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
          meta: {
            type: 'object',
            properties: {
              source: { type: 'string' },
            },
            required: ['source'],
          },
        },
        required: ['tone'],
      },
      target: { framework: 'react', runtime: 'web' },
      ai: { mode: 'scaffold', execution: 'build' },
    };

    const code = generator.generate(spec, {
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(code).toContain('tone: "info" | "warning";');
    expect(code).toContain('count?: number;');
    expect(code).toContain('tags?: string[];');
    expect(code).toContain('source: string;');
  });

  it('should expose declared design tokens as typed component props', () => {
    const spec: ValidatedComponentSpec = {
      apiVersion: 'amaryllis/v1alpha1',
      kind: 'ComponentSpec',
      metadata: { name: 'token-card', version: '1.0.0' },
      props: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
        required: ['title'],
      },
      target: { framework: 'react', runtime: 'web' },
      ui: {
        designTokens: {
          spacing: ['cardGap'],
          typography: ['titleStyle'],
          colorRoles: ['accent'],
        },
      },
      ai: { mode: 'scaffold', execution: 'build' },
    };

    const code = generator.generate(spec, {
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(code).toContain('designTokens?: {');
    expect(code).toContain('spacing?: {');
    expect(code).toContain('cardGap?: string;');
    expect(code).toContain('typography?: {');
    expect(code).toContain('titleStyle?: string;');
    expect(code).toContain('colorRoles?: {');
    expect(code).toContain('accent?: string;');
    expect(code).toContain('designTokens,');
  });

  it('should use a native fallback layout for React Native specs', () => {
    const spec: ValidatedComponentSpec = {
      apiVersion: 'amaryllis/v1alpha1',
      kind: 'ComponentSpec',
      metadata: { name: 'native-card', version: '1.0.0' },
      props: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
        required: ['title'],
      },
      target: { framework: 'react', runtime: 'rn' },
      ai: { mode: 'scaffold', execution: 'build' },
    };

    const code = generator.generate(spec, {
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(code).toContain("import { View, Text } from 'react-native';");
    expect(code).toContain('<View>{children}</View>');
    expect(code).not.toContain('<div>{children}</div>');
  });

  it('should fail closed on unsafe layout strings', () => {
    const spec: ValidatedComponentSpec = {
      apiVersion: 'amaryllis/v1alpha1',
      kind: 'ComponentSpec',
      metadata: { name: 'unsafe-card', version: '1.0.0' },
      props: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
      },
      target: { framework: 'react', runtime: 'web' },
      ui: {
        layout: "<script>alert('x')</script>",
      },
      ai: { mode: 'scaffold', execution: 'build' },
    };

    expect(() => generator.generate(spec)).toThrow(
      'Unsafe layout contains executable code or import/export syntax.'
    );
  });
});
