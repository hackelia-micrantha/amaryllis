import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useState,
} from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isGenerating?: boolean;
}

interface PromptContext {
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  error: Error | undefined;
  setError: Dispatch<SetStateAction<Error | undefined>>;
  isBusy: boolean;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  isSessionReady: boolean;
  setIsSessionReady: Dispatch<SetStateAction<boolean>>;
  images: string[];
  setImages: Dispatch<SetStateAction<string[]>>;
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
}

interface PromptProviderProps {
  children: React.ReactNode;
}

const PromptContext = createContext<PromptContext>({
  messages: [],
  setMessages: () => {},
  error: undefined,
  setError: () => {},
  isBusy: false,
  setIsBusy: () => {},
  isSessionReady: false,
  setIsSessionReady: () => {},
  images: [],
  setImages: () => {},
  prompt: '',
  setPrompt: () => {},
});

export const usePromptContext = () => useContext(PromptContext);

/**
 * Provides LLM configuration state to child components.
 * Configures LLM once on mount.
 */
export const PromptProvider = ({ children }: PromptProviderProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isSessionReady, setIsSessionReady] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>('');

  return (
    <PromptContext.Provider
      value={{
        messages,
        setMessages,
        images,
        setImages,
        isBusy,
        setIsBusy,
        isSessionReady,
        setIsSessionReady,
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
