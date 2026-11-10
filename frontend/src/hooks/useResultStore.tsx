import { createContext, ReactNode, useContext, useState } from 'react';
import { MediaAvailability, MediaMetadata } from '@/types/media';

export interface ResultState {
  url: string;
  media: MediaMetadata | null;
  availability: MediaAvailability | null;
  errorMessage: string | null;
}

export interface ResultStoreValue {
  result: ResultState;
  setResult: (result: ResultState | Partial<ResultState> | ((prev: ResultState) => ResultState)) => void;
  setUrl: (url: string) => void;
  clearResult: () => void;
}

const STORAGE_KEY = 'mdp_active_media_result';

const INITIAL_STATE: ResultState = {
  url: '',
  media: null,
  availability: null,
  errorMessage: null,
};

function loadStoredResult(): ResultState {
  if (typeof window === 'undefined') return INITIAL_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          url: typeof parsed.url === 'string' ? parsed.url : '',
          media: parsed.media ?? null,
          availability: parsed.availability ?? null,
          errorMessage: parsed.errorMessage ?? null,
        };
      }
    }
  } catch {
    // Ignore JSON errors
  }
  return INITIAL_STATE;
}

const ResultContext = createContext<ResultStoreValue | undefined>(undefined);

export function ResultProvider({ children }: { children: ReactNode }): JSX.Element {
  const [result, setResultState] = useState<ResultState>(loadStoredResult);

  const setResult = (next: ResultState | Partial<ResultState> | ((prev: ResultState) => ResultState)): void => {
    setResultState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      const updated: ResultState = {
        url: value.url !== undefined ? value.url : prev.url,
        media: value.media !== undefined ? value.media : prev.media,
        availability: value.availability !== undefined ? value.availability : prev.availability,
        errorMessage: value.errorMessage !== undefined ? value.errorMessage : prev.errorMessage,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage quota or private mode error
      }
      return updated;
    });
  };

  const setUrl = (url: string): void => {
    setResult((prev) => ({ ...prev, url }));
  };

  const clearResult = (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setResultState(INITIAL_STATE);
  };

  return (
    <ResultContext.Provider value={{ result, setResult, setUrl, clearResult }}>
      {children}
    </ResultContext.Provider>
  );
}

export function useResultStore(): ResultStoreValue {
  const context = useContext(ResultContext);
  if (!context) {
    throw new Error('useResultStore must be used within a ResultProvider');
  }
  return context;
}
