import { motion } from 'framer-motion';
import { AudioLines, DownloadCloud } from 'lucide-react';
import { AudioStream } from '@/types/media';
import { formatBytes } from '@/utils/format';

interface AudioCardProps {
  stream: AudioStream;
  index: number;
  onDownload: (stream: AudioStream) => void;
  isQueued: boolean;
}

export function AudioCard({ stream, index, onDownload, isQueued }: AudioCardProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      whileHover={{ y: -4 }}
      className="glass-panel group flex flex-col gap-4 p-5 transition-shadow duration-300 hover:shadow-glow-success"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
          <AudioLines className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">{(stream.format ?? stream.container ?? 'Audio').toUpperCase()}</p>
          <p className="text-xs text-white/40">{stream.audioCodec ?? 'Unknown codec'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/40">Bitrate</p>
          <p className="truncate font-medium text-white/80">
            {stream.bitrateKbps ? `${Math.round(stream.bitrateKbps)} kbps` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/40">File size</p>
          <p className="truncate font-medium text-white/80">{formatBytes(stream.estimatedSizeBytes)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDownload(stream)}
        disabled={isQueued}
        className="btn-primary mt-1 w-full bg-success/90 hover:bg-success hover:shadow-glow-success disabled:bg-white/10 disabled:animate-pulse"
      >
        <DownloadCloud className={`h-4 w-4 ${isQueued ? 'animate-spin' : ''}`} />
        {isQueued ? 'Preparing...' : 'Download'}
      </button>
    </motion.div>
  );
}
