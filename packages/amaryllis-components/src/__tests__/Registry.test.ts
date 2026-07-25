import type { ComponentType } from 'react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';
import { createTestComponentRegistry } from './testRegistry';
import {
  ComponentRegistry,
  createRegistryIdentity,
  fnv1aHash,
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
    const registry = createTestComponentRegistry();
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
    const identity = createRegistryIdentity(
      {
        component: Component,
        spec: baseSpec,
        contract,
        implementationIdentity: 'registry-card/react',
      },
      fnv1aHash
    );

    expect(identity).toEqual({
      key: 'registry-card@1.0.0',
      componentName: 'registry-card',
      version: '1.0.0',
      specHash: hashRegistryValue(baseSpec, fnv1aHash),
      runtimeContractHash: hashRegistryValue(contract, fnv1aHash),
      implementationIdentity: 'registry-card/react',
    });
  });

  test('uses a deterministic default hash for registry metadata', () => {
    const registry = new ComponentRegistry();

    registry.register('registry-card', {
      component: Component,
      spec: baseSpec,
      contract,
      implementationIdentity: 'registry-card/react',
    });

    expect(registry.get('registry-card')).toMatchObject({
      specHash: hashRegistryValue(baseSpec, fnv1aHash),
      runtimeContractHash: hashRegistryValue(contract, fnv1aHash),
    });
  });

  test('matches the stable FNV-1a digest for registry metadata', () => {
    expect(hashRegistryValue({ title: 'hello', count: 3 }, fnv1aHash)).toBe(
      'd72af607'
    );
  });

  test('rejects registration when supplied identity metadata does not match the entry', () => {
    const registry = createTestComponentRegistry();

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
        specHash: hashRegistryValue({ different: true }, fnv1aHash),
        implementationIdentity: 'registry-card/react',
      })
    ).toThrow('specHash does not match spec');
  });

  test('rejects silent replacement unless replace is explicit', () => {
    const registry = createTestComponentRegistry();
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

  test('snapshots and hydrates registry entries with resolved implementations', () => {
    const registry = createTestComponentRegistry();
    registry.register('registry-card', {
      component: Component,
      spec: baseSpec,
      contract,
      implementationIdentity: 'registry-card/react',
    });

    const snapshot = registry.snapshot();
    const restored = createTestComponentRegistry();
    restored.hydrate(snapshot, (entry) => {
      expect(entry.key).toBe('registry-card@1.0.0');
      expect(entry.implementationIdentity).toBe('registry-card/react');
      return Component;
    });

    expect(snapshot).toEqual([
      {
        key: 'registry-card@1.0.0',
        componentName: 'registry-card',
        version: '1.0.0',
        specHash: hashRegistryValue(baseSpec, fnv1aHash),
        runtimeContractHash: hashRegistryValue(contract, fnv1aHash),
        implementationIdentity: 'registry-card/react',
        spec: baseSpec,
        contract,
      },
    ]);
    expect(restored.get('registry-card@1.0.0')).toMatchObject({
      component: Component,
      spec: baseSpec,
      contract,
      implementationIdentity: 'registry-card/react',
    });
    expect(restored.get('registry-card')).toEqual(
      restored.get('registry-card@1.0.0')
    );
  });
});
