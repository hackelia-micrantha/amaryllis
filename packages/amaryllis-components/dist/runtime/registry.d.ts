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
export interface RegisterOptions {
    replace?: boolean;
}
export declare function hashRegistryValue(value: unknown): string;
export declare function getRegistryKey(componentName: string, version: string): string;
export declare function createRegistryIdentity(entry: RegisteredComponent): RegistryIdentity;
export declare class ComponentRegistry {
    private components;
    private latestByName;
    register(name: string, entry: RegisteredComponent, options?: RegisterOptions): void;
    get(name: string): BoundRegisteredComponent | undefined;
    list(): string[];
    private assertRegistrationMatches;
    private getLatestByComponentName;
    private updateLatest;
}
export declare const globalRegistry: ComponentRegistry;
