import { motion } from 'framer-motion';
import { DownloadCloud, Film, Scissors, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MediaMetadata, VideoStream } from '@/types/media';
import { formatBytes } from '@/utils/format';

interface StreamCardProps {
  stream: VideoStream;
  media: MediaMetadata;
  index: number;
  onDownload: (stream: VideoStream) => void;
  isQueued: boolean;
}

export function StreamCard({ stream, media, index, onDownload, isQueued }: StreamCardProps): JSX.Element {
  const navigate = useNavigate();

  const handleClip = (): void => {
    navigate('/clip', { state: { stream, media } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      whileHover={{ y: -4 }}
      className="glass-panel group flex flex-col gap-4 p-5 transition-shadow duration-300 hover:shadow-glow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Film className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{stream.resolution ?? 'Unknown'}</p>
            {stream.fps && <p className="text-xs text-white/40">{stream.fps} fps</p>}
          </div>
        </div>
        {/* Downloads always merge best audio — always show audio badge */}
        <span title="Downloaded with audio (auto-merged)" className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
          <Volume2 className="h-3 w-3" />
          Audio
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/40">Codec</p>
          <p className="truncate font-medium text-white/80">{stream.videoCodec ?? 'N/A'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/40">Container</p>
          <p className="truncate font-medium text-white/80">{(stream.container ?? 'N/A').toUpperCase()}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/40">File size</p>
          <p className="truncate font-medium text-white/80">{formatBytes(stream.estimatedSizeBytes)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/40">Bitrate</p>
          <p className="truncate font-medium text-white/80">
            {stream.bitrateKbps ? `${Math.round(stream.bitrateKbps)} kbps` : 'N/A'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDownload(stream)}
          disabled={isQueued}
          className="btn-primary mt-1 flex-1 disabled:bg-white/10"
        >
          <DownloadCloud className="h-4 w-4" />
          {isQueued ? 'Queued' : 'Download'}
        </button>
        <button
          type="button"
          onClick={handleClip}
          className="mt-1 flex items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 px-3 text-primary transition hover:bg-primary/20"
          title="Clip this video"
        >
          <Scissors className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
