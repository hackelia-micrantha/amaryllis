import type { ValidatedComponentSpec } from '../schema/spec.schema';
import type { PersonalizationContract } from './engine';
export interface RegisteredComponent {
    component: React.ComponentType<Record<string, unknown>>;
    spec: ValidatedComponentSpec;
    contract: PersonalizationContract;
}
export declare class ComponentRegistry {
    private components;
    register(name: string, entry: RegisteredComponent): void;
    get(name: string): RegisteredComponent | undefined;
    list(): string[];
}
export declare const globalRegistry: ComponentRegistry;
