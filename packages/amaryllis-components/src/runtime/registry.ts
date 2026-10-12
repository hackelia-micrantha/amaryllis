/* eslint-disable no-bitwise */
import type { ComponentType } from 'react';
import {
  compare as compareSemver,
  prerelease as semverPrerelease,
  valid as validSemver,
} from 'semver';
import type { ValidatedComponentSpec } from '../schema/spec.schema';
import type { PersonalizationContract } from './engine';

export interface RegisteredComponent {
  component: ComponentType<Record<string, unknown>>;
  spec: ValidatedComponentSpec;
  contract: PersonalizationContract;
  componentName?: string;
  version?: string;
  specHash?: string;
  runtimeContractHash?: string;
  implementationIdentity?: string;
}

export interface RegistryIdentity {
  key: string;
  componentName: string;
  version: string;
  specHash: string;
  runtimeContractHash: string;
  implementationIdentity: string;
}

export type BoundRegisteredComponent = RegisteredComponent & RegistryIdentity;

export type RegistrySnapshotEntry = Omit<BoundRegisteredComponent, 'component'>;

export type RegistryComponentResolver = (
  entry: RegistrySnapshotEntry
) => ComponentType<Record<string, unknown>>;

export interface RegisterOptions {
  replace?: boolean;
}

export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export type RegistryHashFunction = (canonicalValue: string) => string;

export function fnv1aHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const hashRegistryValue = (
  value: unknown,
  hash: RegistryHashFunction = fnv1aHash
): string => {
  return hash(stableStringify(value));
};

export function getRegistryKey(componentName: string, version: string): string {
  return `${componentName}@${version}`;
}

export function createRegistryIdentity(
  entry: RegisteredComponent,
  hash: RegistryHashFunction = fnv1aHash
): RegistryIdentity {
  const componentName = entry.spec.metadata.name;
  const version = entry.spec.metadata.version;

  return {
    key: getRegistryKey(componentName, version),
    componentName,
    version,
    specHash: hashRegistryValue(entry.spec, hash),
    runtimeContractHash: hashRegistryValue(entry.contract, hash),
    implementationIdentity:
      entry.implementationIdentity ??
      `${componentName}@${version}:implementation`,
  };
}
export interface ComponentRegistryOptions {
  hash?: RegistryHashFunction;
}

export class ComponentRegistry {
  private components: Map<string, BoundRegisteredComponent> = new Map();
  private hash: RegistryHashFunction;

  constructor(options: ComponentRegistryOptions = {}) {
    this.hash = options.hash ?? fnv1aHash;
  }

  register(
    name: string,
    entry: RegisteredComponent,
    options: RegisterOptions = {}
  ): void {
    const identity = createRegistryIdentity(entry, this.hash);

    if (!validSemver(identity.version)) {
      throw new Error(`invalid SemVer for component ${identity.componentName}: ${identity.version}`);
    }

    this.assertRegistrationMatches(name, entry, identity);

    if (!options.replace && this.components.has(identity.key)) {
      throw new Error(
        `Component ${identity.key} is already registered. Pass { replace: true } to replace it.`
      );
    }

    this.components.set(identity.key, {
      ...entry,
      ...identity,
    });

  }

  /** Exact versioned identity only: never select an executable implicitly. */
  get(key: string): BoundRegisteredComponent | undefined {
    return this.components.get(key);
  }

  getExact(key: string): BoundRegisteredComponent | undefined {
    return this.components.get(key);
  }

  /** Explicitly opt into moving version selection (e.g. development/tooling). */
  getLatest(
    componentName: string,
    options: { includePrerelease?: boolean } = {}
  ): BoundRegisteredComponent | undefined {
    const candidates = Array.from(this.components.values()).filter(
      (entry) => entry.componentName === componentName
    );
    const stable = candidates.filter(
      (entry) => semverPrerelease(entry.version) === null
    );
    const eligible = options.includePrerelease
      ? candidates
      : stable.length > 0
        ? stable
        : candidates;

    return eligible
      .sort((left, right) => compareSemver(left.version, right.version))
      .at(-1);
  }

  list(): string[] {
    return Array.from(this.components.keys());
  }

  snapshot(): RegistrySnapshotEntry[] {
    return Array.from(this.components.values()).map((entry) => ({
      key: entry.key,
      componentName: entry.componentName,
      version: entry.version,
      specHash: entry.specHash,
      runtimeContractHash: entry.runtimeContractHash,
      implementationIdentity: entry.implementationIdentity,
      spec: entry.spec,
      contract: entry.contract,
    }));
  }

  hydrate(
    entries: RegistrySnapshotEntry[],
    resolveComponent: RegistryComponentResolver,
    options: RegisterOptions = {}
  ): void {
    entries.forEach((entry) => {
      this.register(
        entry.key,
        {
          ...entry,
          component: resolveComponent(entry),
        },
        options
      );
    });
  }

  private assertRegistrationMatches(
    name: string,
    entry: RegisteredComponent,
    identity: RegistryIdentity
  ): void {
    if (name.includes('@') && name !== identity.key) {
      throw new Error('registry key does not match spec metadata');
    }

    if (!name.includes('@') && name !== identity.componentName) {
      throw new Error('name does not match spec.metadata.name');
    }

    if (
      entry.componentName !== undefined &&
      entry.componentName !== identity.componentName
    ) {
      throw new Error('componentName does not match spec.metadata.name');
    }

    if (entry.version !== undefined && entry.version !== identity.version) {
      throw new Error('version does not match spec.metadata.version');
    }

    if (entry.specHash !== undefined && entry.specHash !== identity.specHash) {
      throw new Error('specHash does not match spec');
    }

    if (
      entry.runtimeContractHash !== undefined &&
      entry.runtimeContractHash !== identity.runtimeContractHash
    ) {
      throw new Error('runtimeContractHash does not match contract');
    }
  }

}
