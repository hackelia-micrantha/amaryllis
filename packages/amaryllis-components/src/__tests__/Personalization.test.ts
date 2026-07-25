import type { ComponentType } from 'react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';
import { registry as globalRegistry } from './testRegistry';
import { PersonalizationEngine } from '../runtime/engine';
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
      designTokens: {
        colorRoles: ['accent'],
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
        domAccess: 'restricted',
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
    expect(result.diagnostics).toEqual({
      accepted: true,
      errorCount: 0,
      usedPatchOverlay: false,
      sanitizedKeys: [],
    });
  });

  test('should fail validation for incorrect data types', () => {
    const aiOutput = {
      props: { title: 123 }, // Should be string
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.diagnostics?.accepted).toBe(false);
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

  test('should merge nested personalization props without dropping base data', () => {
    const baseProps = {
      title: 'Base',
      settings: {
        theme: 'light',
        density: 'comfortable',
      },
    };
    const personalization = {
      props: {
        settings: {
          density: 'compact',
        },
      },
    };

    const finalProps = engine.apply(baseProps, personalization);

    expect(finalProps).toEqual({
      title: 'Base',
      settings: {
        theme: 'light',
        density: 'compact',
      },
    });
  });

  test('should ignore unsafe overlay keys when applying personalization props', () => {
    const unsafeProps = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"polluted":true},"title":"Safe"}'
    );

    const finalProps = engine.apply({ title: 'Base' }, { props: unsafeProps });

    expect(finalProps).toEqual({ title: 'Safe' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('should apply bounded JSON Patch overlays to derived personalization data', () => {
    const aiOutput = {
      props: { title: 'Base AI title' },
      patches: [
        { op: 'replace', path: '/props/title', value: 'Patched title' },
        { op: 'add', path: '/variant', value: 'compact' },
        { op: 'add', path: '/slots/content', value: 'Patched content' },
        { op: 'add', path: '/designTokens/accent', value: 'brand.primary' },
      ],
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(true);
    expect(result.diagnostics?.usedPatchOverlay).toBe(true);
    expect(result.data).toEqual({
      props: { title: 'Patched title' },
      variant: 'compact',
      slots: { content: 'Patched content' },
      designTokens: { accent: 'brand.primary' },
    });

    const finalProps = engine.apply({ title: 'Base' }, result.data ?? {});
    expect(finalProps).toEqual({
      title: 'Patched title',
      variant: 'compact',
      content: 'Patched content',
      designTokens: { accent: 'brand.primary' },
    });
  });

  test('should fail closed for JSON Patch paths outside declared personalization data', () => {
    const aiOutput = {
      props: { title: 'Hello' },
      patches: [
        { op: 'add', path: '/props/dangerous', value: '<script />' },
        { op: 'replace', path: '/policy/runtime/networkAccess', value: 'all' },
        { op: 'replace', path: '/metadata/name', value: 'other-card' },
        { op: 'add', path: '/slots/footer', value: 'Undeclared slot' },
        { op: 'add', path: '/designTokens/unknown', value: 'token' },
      ],
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      '/patches/0/path must target a declared personalization path',
      '/patches/1/path must target a declared personalization path',
      '/patches/2/path must target a declared personalization path',
      '/patches/3/path must target a declared personalization path',
      '/patches/4/path must target a declared personalization path',
    ]);
  });

  test('should fail closed when patched output violates the contract', () => {
    const aiOutput = {
      props: { title: 'Hello' },
      patches: [{ op: 'replace', path: '/props/title', value: 123 }],
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(false);
    expect(result.errors?.join('\n')).toContain('/props/title must be string');
  });

  test('should reject unsafe JSON Patch values', () => {
    const aiOutput = {
      props: { title: 'Hello' },
      patches: [
        {
          op: 'add',
          path: '/props/title',
          value: JSON.parse('{"__proto__":{"polluted":true}}'),
        },
      ],
    };

    const result = engine.validate(contract, aiOutput);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Personalization data contains an unsafe object key'
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
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
