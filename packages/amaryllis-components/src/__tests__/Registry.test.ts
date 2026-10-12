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
  test('registers components by exact versioned identity without implicit latest', () => {
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
    expect(registry.get('registry-card')).toBeUndefined();
    expect(registry.getExact('registry-card@1.0.0')).toEqual(
      registry.get('registry-card@1.0.0')
    );
    expect(registry.getLatest('registry-card')).toEqual(
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

    expect(registry.get('registry-card@1.0.0')).toMatchObject({
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
    expect(restored.get('registry-card')).toBeUndefined();
    expect(restored.getLatest('registry-card')).toEqual(
      restored.getExact('registry-card@1.0.0')
    );
  });

  test('pinned executable resolution is stable when newer versions register', () => {
    const registry = createTestComponentRegistry();
    const registered = (version: string) => ({
      component: Component,
      spec: {
        ...baseSpec,
        metadata: { ...baseSpec.metadata, version },
      },
      contract,
    });
    registry.register('registry-card', registered('1.9.0'));
    const pinned = registry.get('registry-card@1.9.0');
    registry.register('registry-card', registered('1.10.0'));

    expect(registry.get('registry-card@1.9.0')).toBe(pinned);
    expect(registry.getExact('registry-card@1.9.0')).toBe(pinned);
    expect(registry.get('registry-card')).toBeUndefined();
    expect(registry.getLatest('registry-card')?.version).toBe('1.10.0');
  });

  test('stable latest wins unless all entries are prereleases or opt-in requested', () => {
    const registry = createTestComponentRegistry();
    const register = (version: string) => {
      registry.register('registry-card', {
        component: Component,
        spec: { ...baseSpec, metadata: { ...baseSpec.metadata, version } },
        contract,
      });
    };
    register('2.0.0-beta.2');
    register('2.0.0-beta.11');
    expect(registry.getLatest('registry-card')?.version).toBe('2.0.0-beta.11');
    register('1.10.0');
    register('1.9.0');
    expect(registry.getLatest('registry-card')?.version).toBe('1.10.0');
    expect(
      registry.getLatest('registry-card', { includePrerelease: true })?.version
    ).toBe('2.0.0-beta.11');
    register('2.0.0');
    expect(registry.getLatest('registry-card')?.version).toBe('2.0.0');
  });

  test('invalid SemVer fails before registration and while hydrating', () => {
    const registry = createTestComponentRegistry();
    const invalid = {
      component: Component,
      spec: {
        ...baseSpec,
        metadata: { ...baseSpec.metadata, version: 'release-next' },
      },
      contract,
    };
    expect(() => registry.register('registry-card', invalid)).toThrow(
      'invalid SemVer'
    );
    expect(registry.list()).toEqual([]);

    const snapshotSource = createTestComponentRegistry();
    snapshotSource.register('registry-card', {
      component: Component,
      spec: baseSpec,
      contract,
    });
    const [snapshot] = snapshotSource.snapshot();
    const invalidSnapshot = {
      ...snapshot,
      version: 'release-next',
      spec: invalid.spec,
    };
    const resolver = jest.fn(() => Component);
    expect(() =>
      registry.hydrate([invalidSnapshot], resolver)
    ).toThrow('invalid SemVer');
    expect(resolver).not.toHaveBeenCalled();
    expect(registry.list()).toEqual([]);

    const mismatched = {
      ...snapshot,
      specHash: 'untrusted-hash',
    };
    expect(() =>
      registry.hydrate([mismatched], resolver)
    ).toThrow('specHash does not match spec');
    expect(resolver).not.toHaveBeenCalled();
  });
});
