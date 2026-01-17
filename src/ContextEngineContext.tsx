import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { ContextEngine } from './ContextTypes';

export interface ContextEngineProviderProps {
  engine: ContextEngine;
  children: ReactNode;
}

interface ContextEngineContextValue {
  engine: ContextEngine | null;
}

const ContextEngineContext = createContext<ContextEngineContextValue>({
  engine: null,
});

export const ContextEngineProvider = ({
  engine,
  children,
}: ContextEngineProviderProps) => {
  return (
    <ContextEngineContext.Provider value={{ engine }}>
      {children}
    </ContextEngineContext.Provider>
  );
};

export const useContextEngine = (): ContextEngine | null => {
  return useContext(ContextEngineContext).engine;
};
