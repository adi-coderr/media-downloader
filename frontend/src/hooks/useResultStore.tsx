import { createContext, ReactNode, useContext, useState } from 'react';
import { MediaAvailability, MediaMetadata } from '@/types/media';

interface ResultState {
  media: MediaMetadata | null;
  availability: MediaAvailability | null;
  errorMessage: string | null;
}

interface ResultStoreValue {
  result: ResultState;
  setResult: (result: ResultState) => void;
  clearResult: () => void;
}

const INITIAL_STATE: ResultState = { media: null, availability: null, errorMessage: null };

const ResultContext = createContext<ResultStoreValue | undefined>(undefined);

export function ResultProvider({ children }: { children: ReactNode }): JSX.Element {
  const [result, setResult] = useState<ResultState>(INITIAL_STATE);

  const clearResult = (): void => setResult(INITIAL_STATE);

  return (
    <ResultContext.Provider value={{ result, setResult, clearResult }}>{children}</ResultContext.Provider>
  );
}

export function useResultStore(): ResultStoreValue {
  const context = useContext(ResultContext);
  if (!context) {
    throw new Error('useResultStore must be used within a ResultProvider');
  }
  return context;
}
