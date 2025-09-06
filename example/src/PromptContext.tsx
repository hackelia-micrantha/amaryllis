import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useState,
} from 'react';

interface PromptContext {
  results: string[];
  setResults: Dispatch<SetStateAction<string[]>>;
  error: Error | undefined;
  setError: Dispatch<SetStateAction<Error | undefined>>;
  isBusy: boolean;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  images: string[];
  setImages: Dispatch<SetStateAction<string[]>>;
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
}

interface PromptProviderProps {
  children: React.ReactNode;
}

const PromptContext = createContext<PromptContext>({
  results: [],
  setResults: function (_value: SetStateAction<string[]>): void {
    throw new Error('Function not implemented');
  },
  error: undefined,
  setError: function (_value: SetStateAction<Error | undefined>): void {
    throw new Error('Function not implemented.');
  },
  isBusy: false,
  setIsBusy: function (_value: SetStateAction<boolean>): void {
    throw new Error('Function not implemented.');
  },
  images: [],
  setImages: function (_value: SetStateAction<string[]>): void {
    throw new Error('Function not implemented.');
  },
  prompt: '',
  setPrompt: function (_value: SetStateAction<string>): void {
    throw new Error('Function not implemented.');
  },
});

export const usePromptContext = () => useContext(PromptContext);

/**
 * Provides LLM configuration state to child components.
 * Configures LLM once on mount.
 */
export const PromptProvider = ({ children }: PromptProviderProps) => {
  const [results, setResults] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>('');

  return (
    <PromptContext.Provider
      value={{
        results,
        setResults,
        images,
        setImages,
        isBusy,
        setIsBusy,
        error,
        setError,
        prompt,
        setPrompt,
      }}
    >
      {children}
    </PromptContext.Provider>
  );
};
