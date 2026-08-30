import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { Clipboard, Link2, Search } from 'lucide-react';
import { isLikelyValidUrl, normalizeUrl } from '@/utils/format';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps): JSX.Element {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const isValid = value.trim().length === 0 || isLikelyValidUrl(value);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setTouched(true);
    if (!isLikelyValidUrl(value)) {
      return;
    }
    onSubmit(normalizeUrl(value));
  };

  const handlePaste = async (): Promise<void> => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setValue(clipboardText.trim());
        setTouched(true);
      }
    } catch {
      // Clipboard access may be denied by the browser; user can paste manually.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`glass-panel flex flex-col gap-3 p-3 transition-all duration-300 sm:flex-row sm:items-center ${
          touched && !isValid ? 'ring-2 ring-danger/60' : 'focus-within:ring-2 focus-within:ring-primary/60'
        }`}
      >
        <div className="flex flex-1 items-center gap-3 px-3">
          <Link2 className="h-5 w-5 shrink-0 text-white/40" />
          <input
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (!touched) setTouched(true);
            }}
            placeholder="Paste a public, non-DRM video URL…"
            className="w-full bg-transparent py-3 text-base text-black placeholder-black/30 outline-none"
            aria-label="Media URL"
            aria-invalid={touched && !isValid}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePaste}
            className="btn-secondary shrink-0"
            aria-label="Paste URL from clipboard"
          >
            <Clipboard className="h-4 w-4" />
            <span className="hidden sm:inline">Paste</span>
          </button>
          <motion.button
            type="submit"
            disabled={isLoading || value.trim().length === 0}
            whileTap={{ scale: 0.96 }}
            className="btn-primary shrink-0"
          >
            {isLoading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
              />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>{isLoading ? 'Analyzing…' : 'Analyze'}</span>
          </motion.button>
        </div>
      </div>
      {touched && !isValid && (
        <p className="mt-2 px-2 text-sm text-danger">Please enter a valid http:// or https:// URL.</p>
      )}
    </form>
  );
}
