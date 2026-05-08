import { createHash } from 'crypto';
import type { ComponentType } from 'react';
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

function stableStringify(value: unknown): string {
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

export function hashRegistryValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function getRegistryKey(componentName: string, version: string): string {
  return `${componentName}@${version}`;
}

export function createRegistryIdentity(
  entry: RegisteredComponent
): RegistryIdentity {
  const componentName = entry.spec.metadata.name;
  const version = entry.spec.metadata.version;

  return {
    key: getRegistryKey(componentName, version),
    componentName,
    version,
    specHash: hashRegistryValue(entry.spec),
    runtimeContractHash: hashRegistryValue(entry.contract),
    implementationIdentity:
      entry.implementationIdentity ??
      `${componentName}@${version}:implementation`,
  };
}

export class ComponentRegistry {
  private components: Map<string, BoundRegisteredComponent> = new Map();
  private latestByName: Map<string, string> = new Map();

  register(
    name: string,
    entry: RegisteredComponent,
    options: RegisterOptions = {}
  ): void {
    const identity = createRegistryIdentity(entry);
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
    this.updateLatest(identity.componentName);
  }

  get(name: string): BoundRegisteredComponent | undefined {
    return this.components.get(name) ?? this.getLatestByComponentName(name);
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

  private getLatestByComponentName(
    componentName: string
  ): BoundRegisteredComponent | undefined {
    const key = this.latestByName.get(componentName);
    return key ? this.components.get(key) : undefined;
  }

  private updateLatest(componentName: string): void {
    const keys = Array.from(this.components.keys()).filter((key) =>
      key.startsWith(`${componentName}@`)
    );
    const latest = keys.sort(compareRegistryKeys).at(-1);

    if (latest) {
      this.latestByName.set(componentName, latest);
    }
  }
}

function compareRegistryKeys(left: string, right: string): number {
  const leftVersion = left.slice(left.lastIndexOf('@') + 1);
  const rightVersion = right.slice(right.lastIndexOf('@') + 1);
  return leftVersion.localeCompare(rightVersion, undefined, { numeric: true });
}

// Global registry instance
export const globalRegistry = new ComponentRegistry();
