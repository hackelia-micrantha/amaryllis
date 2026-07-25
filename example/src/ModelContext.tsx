import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useState,
} from 'react';

export type ModelImportPaths = {
  llmModelPath: string;
  imageEmbedderModelPath?: string;
  objectDetectorModelPath?: string;
};

interface ModelContext {
  paths: ModelImportPaths | null;
  setPaths: Dispatch<SetStateAction<ModelImportPaths | null>>;
}

interface ModelProviderProps {
  children: React.ReactNode;
}

const ModelContext = createContext<ModelContext>({
  paths: null,
  setPaths: function (_value: SetStateAction<ModelImportPaths | null>): void {
    throw new Error('Function not implemented');
  },
});

export const useModelContext = () => useContext(ModelContext);

/**
 * Provides LLM configuration state to child components.
 * Configures LLM once on mount.
 */
export const ModelProvider = ({ children }: ModelProviderProps) => {
  const [paths, setPaths] = useState<ModelImportPaths | null>(null);

  return (
    <ModelContext.Provider
      value={{
        paths,
        setPaths,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
};
