import { atom, useAtom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

export const promptAtom = atomWithReset('');
export const imagesAtom = atomWithReset<string[]>([]); // New atom for images
export const resultsAtom = atomWithReset<string[]>([]);
export const isBusyAtom = atom(false);
export const errorAtom = atom<Error | undefined>(undefined);

export const usePromptState = () => {
  const [prompt, setPrompt] = useAtom(promptAtom);
  const [images, setImages] = useAtom(imagesAtom); // Hook for images
  const [results, setResults] = useAtom(resultsAtom);
  const [isBusy, setIsBusy] = useAtom(isBusyAtom);
  const [error, setError] = useAtom(errorAtom);

  return {
    prompt,
    setPrompt,
    images,
    setImages, // Return setter for images
    results,
    setResults,
    isBusy,
    setIsBusy,
    error,
    setError,
  };
};
