import { type ReactNode } from 'react';
import { ComponentRegistry, type RegistryHashFunction } from './registry';
export declare function useRegistry(): ComponentRegistry;
export interface RegistryProviderProps {
    hash?: RegistryHashFunction;
    initialize?: (registry: ComponentRegistry) => void;
    children?: ReactNode;
}
export declare function RegistryProvider({ hash, initialize, children, }: RegistryProviderProps): import("react/jsx-runtime").JSX.Element;
