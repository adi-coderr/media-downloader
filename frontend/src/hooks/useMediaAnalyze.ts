import { useCallback, useRef, useState } from 'react';
import { analyzeMediaUrl } from '@/api/mediaApi';
import { ApiError } from '@/api/client';
import { MediaAvailability, MediaMetadata } from '@/types/media';

interface AnalyzeState {
  isLoading: boolean;
  media: MediaMetadata | null;
  availability: MediaAvailability | null;
  errorMessage: string | null;
}

interface UseMediaAnalyzeResult extends AnalyzeState {
  analyze: (url: string) => Promise<void>;
  reset: () => void;
}

export function useMediaAnalyze(): UseMediaAnalyzeResult {
  const [state, setState] = useState<AnalyzeState>({
    isLoading: false,
    media: null,
    availability: null,
    errorMessage: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ isLoading: true, media: null, availability: null, errorMessage: null });

    try {
      const response = await analyzeMediaUrl(url, controller.signal);

      if (response.success && response.media) {
        setState({
          isLoading: false,
          media: response.media,
          availability: response.availability,
          errorMessage: null,
        });
        return;
      }

      setState({
        isLoading: false,
        media: null,
        availability: response.availability,
        errorMessage: response.message ?? 'Unable to analyze this URL.',
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
      setState({ isLoading: false, media: null, availability: 'invalid', errorMessage: message });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ isLoading: false, media: null, availability: null, errorMessage: null });
  }, []);

  return { ...state, analyze, reset };
}
