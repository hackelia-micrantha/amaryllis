import type { ComponentType } from 'react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

import { PersonalizationEngine } from '../runtime/engine';
import { globalRegistry } from '../runtime/registry';
import { JSONSchemaGenerator } from '../generator/schema';

describe('Personalization', () => {
  const mockSpec: ValidatedComponentSpec = {
    apiVersion: 'amaryllis/v1alpha1',
    kind: 'ComponentSpec',
    metadata: { name: 'test-card', version: '1.0.0' },
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
      slots: ['content'],
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

  const schemaGenerator = new JSONSchemaGenerator();
  const contract = JSON.parse(schemaGenerator.generate(mockSpec));
  const engine = new PersonalizationEngine();

  test('should validate correct personalization data', () => {
    const aiOutput = {
      props: { title: 'Hello AI', count: 42 },
      variant: 'compact',
      slots: { content: 'Dynamic Content' },
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(true);
    expect(result.data).toEqual(aiOutput);
  });

  test('should fail validation for incorrect data types', () => {
    const aiOutput = {
      props: { title: 123 }, // Should be string
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  test('should fail validation for missing required props', () => {
    const aiOutput = {
      props: { count: 1 }, // Missing title
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "/props must have required property 'title'"
    );
  });

  test('should fail validation for undeclared props', () => {
    const aiOutput = {
      props: { title: 'Hello', dangerous: '<script />' },
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(false);
    expect(result.errors?.join('\n')).toContain(
      '/props must NOT have additional properties'
    );
  });

  test('should fail validation for undeclared slots', () => {
    const aiOutput = {
      props: { title: 'Hello' },
      slots: { footer: 'Undeclared slot' },
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(false);
    expect(result.errors?.join('\n')).toContain(
      '/slots must NOT have additional properties'
    );
  });

  test('should apply personalization to base props', () => {
    const baseProps = { title: 'Base', count: 0 };
    const personalization = {
      props: { title: 'Personalized' },
      variant: 'compact',
    };

    const finalProps = engine.apply(baseProps, personalization);
    expect(finalProps.title).toBe('Personalized');
    expect(finalProps.count).toBe(0);
    expect(finalProps.variant).toBe('compact');
  });

  test('should register and retrieve components in registry', () => {
    const MockComponent = () => null;
    globalRegistry.register('test-card', {
      component: MockComponent as ComponentType<Record<string, unknown>>,
      spec: mockSpec,
      contract,
    });

    const registered = globalRegistry.get('test-card');
    expect(registered).toBeDefined();
    expect(registered?.spec.metadata.name).toBe('test-card');
    expect(registered?.contract).toEqual(contract);
  });
});
