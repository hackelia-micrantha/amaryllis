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
export type RegistryComponentResolver = (entry: RegistrySnapshotEntry) => ComponentType<Record<string, unknown>>;
export interface RegisterOptions {
    replace?: boolean;
}
export declare function stableStringify(value: unknown): string;
export type RegistryHashFunction = (canonicalValue: string) => string;
export declare function fnv1aHash(value: string): string;
export declare const hashRegistryValue: (value: unknown, hash?: RegistryHashFunction) => string;
export declare function getRegistryKey(componentName: string, version: string): string;
export declare function createRegistryIdentity(entry: RegisteredComponent, hash?: RegistryHashFunction): RegistryIdentity;
export interface ComponentRegistryOptions {
    hash?: RegistryHashFunction;
}
export declare class ComponentRegistry {
    private components;
    private latestByName;
    private hash;
    constructor(options?: ComponentRegistryOptions);
    register(name: string, entry: RegisteredComponent, options?: RegisterOptions): void;
    get(name: string): BoundRegisteredComponent | undefined;
    list(): string[];
    snapshot(): RegistrySnapshotEntry[];
    hydrate(entries: RegistrySnapshotEntry[], resolveComponent: RegistryComponentResolver, options?: RegisterOptions): void;
    private assertRegistrationMatches;
    private getLatestByComponentName;
    private updateLatest;
}
