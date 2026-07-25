import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  ComponentRegistry,
  fnv1aHash,
  type RegistryHashFunction,
} from './registry';

const RegistryContext = createContext<ComponentRegistry | null>(null);

export function useRegistry(): ComponentRegistry {
  const registry = useContext(RegistryContext);

  if (!registry) {
    throw new Error('ComponentRegistry not found in context');
  }

  return registry;
}

export interface RegistryProviderProps {
  hash?: RegistryHashFunction;
  initialize?: (registry: ComponentRegistry) => void;
  children?: ReactNode;
}

export function RegistryProvider({
  hash = fnv1aHash,
  initialize,
  children,
}: RegistryProviderProps) {
  const registry = useMemo(() => {
    const nextRegistry = new ComponentRegistry({ hash });
    initialize?.(nextRegistry);
    return nextRegistry;
  }, [hash, initialize]);

  return (
    <RegistryContext.Provider value={registry}>
      {children}
    </RegistryContext.Provider>
  );
}
