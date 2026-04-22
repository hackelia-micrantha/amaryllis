import type { ValidatedComponentSpec } from '../schema/spec.schema';
import type { PersonalizationContract } from './engine';

export interface RegisteredComponent {
  component: React.ComponentType<Record<string, unknown>>;
  spec: ValidatedComponentSpec;
  contract: PersonalizationContract;
}

export class ComponentRegistry {
  private components: Map<string, RegisteredComponent> = new Map();

  register(name: string, entry: RegisteredComponent): void {
    this.components.set(name, entry);
  }

  get(name: string): RegisteredComponent | undefined {
    return this.components.get(name);
  }

  list(): string[] {
    return Array.from(this.components.keys());
  }
}

// Global registry instance
export const globalRegistry = new ComponentRegistry();
