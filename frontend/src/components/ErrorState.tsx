import { motion } from 'framer-motion';
import { LucideIcon, ShieldAlert, SearchX, TriangleAlert } from 'lucide-react';
import { MediaAvailability } from '@/types/media';

interface ErrorStateProps {
  availability: MediaAvailability;
  message: string;
}

interface ErrorConfig {
  icon: LucideIcon;
  color: string;
  glow: string;
  title: string;
}

const CONFIG: Record<MediaAvailability, ErrorConfig> = {
  protected: {
    icon: ShieldAlert,
    color: 'text-danger',
    glow: 'shadow-glow-danger',
    title: 'Protected content',
  },
  not_found: {
    icon: SearchX,
    color: 'text-warning',
    glow: '',
    title: 'Nothing to download',
  },
  invalid: {
    icon: TriangleAlert,
    color: 'text-warning',
    glow: '',
    title: 'Invalid URL',
  },
  available: {
    icon: TriangleAlert,
    color: 'text-warning',
    glow: '',
    title: 'Unexpected state',
  },
};

export function ErrorState({ availability, message }: ErrorStateProps): JSX.Element {
  const config = CONFIG[availability];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-xl px-4 py-16"
    >
      <div className={`glass-panel flex flex-col items-center gap-4 p-10 text-center ${config.glow}`}>
        <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ${config.color}`}>
          <Icon className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white">{config.title}</h2>
        <p className="text-white/60">{message}</p>
      </div>
    </motion.div>
  );
}
