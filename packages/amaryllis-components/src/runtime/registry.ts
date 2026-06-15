import type { ComponentType } from 'react';
import type { ValidatedComponentSpec } from '../schema/spec.schema';
import type { PersonalizationContract } from './engine';

export interface RegisteredComponent {
  component: ComponentType<Record<string, unknown>>;
  spec: ValidatedComponentSpec;
  contract: PersonalizationContract;
}

export interface RegistryIdentity {
  key: string;
  componentName: string;
  version: string;
}

export type BoundRegisteredComponent = RegisteredComponent & RegistryIdentity;

export type RegistrySnapshotEntry = Omit<BoundRegisteredComponent, 'component'>;

export type RegistryComponentResolver = (
  entry: RegistrySnapshotEntry
) => ComponentType<Record<string, unknown>>;

export interface RegisterOptions {
  replace?: boolean;
}

export function getRegistryKey(componentName: string, version: string): string {
  return `${componentName}@${version}`;
}

export function createRegistryIdentity(
  componentName: string,
  version: string
): RegistryIdentity {
  return {
    key: getRegistryKey(componentName, version),
    componentName,
    version,
  };
}

export interface ComponentRegistryOptions {}

export class ComponentRegistry {
  private components: Map<string, BoundRegisteredComponent> = new Map();
  private latestByName: Map<string, string> = new Map();

  constructor(_options: ComponentRegistryOptions = {}) {
    // Options reserved for future extensibility
  }

  register(
    name: string,
    entry: RegisteredComponent,
    options: RegisterOptions = {}
  ): void {
    const componentName = entry.spec.metadata.name;
    const version = entry.spec.metadata.version;
    const identity = createRegistryIdentity(componentName, version);

    this.assertRegistrationMatches(name, identity);

    if (!options.replace && this.components.has(identity.key)) {
      throw new Error(
        `Component ${identity.key} is already registered. Pass { replace: true } to replace it.`
      );
    }

    this.components.set(identity.key, {
      ...entry,
      ...identity,
    });

    this.updateLatest(componentName);
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
    identity: RegistryIdentity
  ): void {
    if (name.includes('@') && name !== identity.key) {
      throw new Error('registry key does not match spec metadata');
    }

    if (!name.includes('@') && name !== identity.componentName) {
      throw new Error('name does not match spec.metadata.name');
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
