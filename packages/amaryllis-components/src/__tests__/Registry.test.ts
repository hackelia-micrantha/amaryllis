import type { ComponentType } from 'react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';

import {
  ComponentRegistry,
  createRegistryIdentity,
  hashRegistryValue,
} from '../runtime/registry';

const Component = (() => null) as ComponentType<Record<string, unknown>>;

const baseSpec: ValidatedComponentSpec = {
  apiVersion: 'amaryllis/v1alpha1',
  kind: 'ComponentSpec',
  metadata: { name: 'registry-card', version: '1.0.0' },
  target: { framework: 'react', runtime: 'rn' },
  props: {
    type: 'object',
    properties: {
      title: { type: 'string' },
    },
    required: ['title'],
  },
  ai: {
    mode: 'personalize',
    execution: 'device',
    generationContract: {
      output: 'props-json',
    },
  },
};

const contract = {
  type: 'object',
  properties: {
    props: {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
    },
  },
};

describe('ComponentRegistry identity binding', () => {
  test('registers components by versioned identity and keeps legacy name lookup', () => {
    const registry = new ComponentRegistry();
    const entry = {
      component: Component,
      spec: baseSpec,
      contract,
      implementationIdentity: 'registry-card/react',
    };

    registry.register('registry-card', entry);

    expect(registry.list()).toEqual(['registry-card@1.0.0']);
    expect(registry.get('registry-card@1.0.0')).toMatchObject({
      ...entry,
      componentName: 'registry-card',
      version: '1.0.0',
      implementationIdentity: 'registry-card/react',
    });
    expect(registry.get('registry-card')).toEqual(
      registry.get('registry-card@1.0.0')
    );
  });

  test('creates deterministic hashes for registry identity metadata', () => {
    const identity = createRegistryIdentity({
      component: Component,
      spec: baseSpec,
      contract,
      implementationIdentity: 'registry-card/react',
    });

    expect(identity).toEqual({
      key: 'registry-card@1.0.0',
      componentName: 'registry-card',
      version: '1.0.0',
      specHash: hashRegistryValue(baseSpec),
      runtimeContractHash: hashRegistryValue(contract),
      implementationIdentity: 'registry-card/react',
    });
  });

  test('rejects registration when supplied identity metadata does not match the entry', () => {
    const registry = new ComponentRegistry();

    expect(() =>
      registry.register('registry-card', {
        component: Component,
        spec: baseSpec,
        contract,
        componentName: 'other-card',
        implementationIdentity: 'registry-card/react',
      })
    ).toThrow('componentName does not match spec.metadata.name');

    expect(() =>
      registry.register('registry-card', {
        component: Component,
        spec: baseSpec,
        contract,
        specHash: hashRegistryValue({ different: true }),
        implementationIdentity: 'registry-card/react',
      })
    ).toThrow('specHash does not match spec');
  });

  test('rejects silent replacement unless replace is explicit', () => {
    const registry = new ComponentRegistry();
    const entry = {
      component: Component,
      spec: baseSpec,
      contract,
      implementationIdentity: 'registry-card/react',
    };
    const replacement = {
      component: Component,
      spec: baseSpec,
      contract,
      implementationIdentity: 'registry-card/react-v2',
    };

    registry.register('registry-card', entry);

    expect(() => registry.register('registry-card', replacement)).toThrow(
      'Component registry-card@1.0.0 is already registered'
    );

    registry.register('registry-card', replacement, { replace: true });

    expect(registry.get('registry-card@1.0.0')).toMatchObject(replacement);
  });
});
