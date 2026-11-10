import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { UrlInput } from './UrlInput';
import { ExampleUrls } from './ExampleUrls';

interface HeroProps {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
  initialUrl?: string;
  onUrlChange?: (url: string) => void;
}

export function Hero({ onAnalyze, isLoading, initialUrl, onUrlChange }: HeroProps): JSX.Element {
  return (
    <section className="relative flex flex-col items-center px-4 pb-16 pt-20 text-center sm:pt-28">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6 flex items-center gap-2 rounded-full border border-glass-border bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        Respects DRM, authentication & access controls
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl"
      >
        Media Downloader
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-5 max-w-xl text-balance text-lg text-white/60"
      >
        Download publicly available or user-authorized media where permitted.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-10 w-full max-w-2xl"
      >
        <UrlInput
          onSubmit={onAnalyze}
          isLoading={isLoading}
          initialValue={initialUrl}
          onValueChange={onUrlChange}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-6 w-full max-w-2xl"
      >
        <ExampleUrls onSelect={onAnalyze} />
      </motion.div>
    </section>
  );
}
