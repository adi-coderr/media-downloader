import { motion } from 'framer-motion';
import { Clock, Film, User } from 'lucide-react';
import { MediaMetadata } from '@/types/media';
import { formatBytes, formatDuration } from '@/utils/format';

interface MediaSummaryCardProps {
  media: MediaMetadata;
}

function bestVideoStream(media: MediaMetadata) {
  return media.videoStreams[0] ?? null;
}

export function MediaSummaryCard({ media }: MediaSummaryCardProps): JSX.Element {
  const best = bestVideoStream(media);

  const specs = [
    { label: 'Resolution', value: best?.resolution ?? 'N/A' },
    { label: 'FPS', value: best?.fps ? `${best.fps}` : 'N/A' },
    { label: 'Video codec', value: best?.videoCodec ?? 'N/A' },
    { label: 'Audio codec', value: best?.audioCodec ?? media.audioStreams[0]?.audioCodec ?? 'N/A' },
    { label: 'Container', value: (best?.container ?? 'N/A').toUpperCase() },
    { label: 'Est. size', value: formatBytes(best?.estimatedSizeBytes) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel flex flex-col gap-6 p-6 sm:flex-row"
    >
      <div className="relative h-56 w-full shrink-0 overflow-hidden rounded-2xl bg-white/5 sm:h-auto sm:w-80">
        {media.thumbnailUrl ? (
          <img
            src={media.thumbnailUrl}
            alt={media.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full min-h-[14rem] w-full items-center justify-center text-white/20">
            <Film className="h-12 w-12" />
          </div>
        )}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <Clock className="h-3 w-3" />
          {formatDuration(media.durationSeconds)}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <h1 className="text-2xl font-bold leading-tight text-white">{media.title}</h1>
        {media.uploader && (
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-white/50">
            <User className="h-3.5 w-3.5" />
            {media.uploader}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {specs.map((spec) => (
            <div key={spec.label} className="rounded-xl border border-glass-border bg-white/5 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-white/40">{spec.label}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">{spec.value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
