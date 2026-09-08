import { motion } from 'framer-motion';
import { CheckCircle2, Download, Pause, Play, X, XCircle, AlertCircle } from 'lucide-react';
import { DownloadJob } from '@/types/media';
import { formatBytes, formatEta, formatSpeed, truncateFilename } from '@/utils/format';
import { getDownloadFileUrl } from '@/api/downloadApi';

interface DownloadItemProps {
  job: DownloadJob;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}

const STATUS_STYLES: Record<DownloadJob['status'], { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'text-white/50 bg-white/5' },
  downloading: { label: 'Downloading', className: 'text-primary bg-primary/15' },
  paused: { label: 'Paused', className: 'text-warning bg-warning/15' },
  completed: { label: 'Completed', className: 'text-success bg-success/15' },
  cancelled: { label: 'Cancelled', className: 'text-white/40 bg-white/5' },
  error: { label: 'Failed', className: 'text-danger bg-danger/15' },
};

export function DownloadItem({ job, onPause, onResume, onCancel }: DownloadItemProps): JSX.Element {
  const progress = job.totalBytes ? Math.min(100, (job.downloadedBytes / job.totalBytes) * 100) : null;
  const status = STATUS_STYLES[job.status];
  const isActive = job.status === 'downloading' || job.status === 'paused' || job.status === 'queued';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="glass-panel flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white" title={job.suggestedFilename}>
            {truncateFilename(job.suggestedFilename)}
          </p>
          <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {job.status === 'downloading' && (
            <button
              type="button"
              onClick={() => onPause(job.id)}
              className="btn-secondary !rounded-full !p-2.5"
              aria-label="Pause download"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
          {job.status === 'paused' && (
            <button
              type="button"
              onClick={() => onResume(job.id)}
              className="btn-secondary !rounded-full !p-2.5"
              aria-label="Resume download"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          {isActive && (
            <button
              type="button"
              onClick={() => onCancel(job.id)}
              className="btn-danger !rounded-full !p-2.5"
              aria-label="Cancel download"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {job.status === 'completed' && (
            <a href={getDownloadFileUrl(job.id)} download className="btn-primary !rounded-full !px-4 !py-2.5">
              <Download className="h-4 w-4" />
              Save
            </a>
          )}
        </div>
      </div>

      {job.status !== 'error' && job.status !== 'cancelled' && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className={`h-full rounded-full ${
                job.status === 'completed' ? 'bg-success' : job.status === 'paused' ? 'bg-warning' : 'bg-primary'
              }`}
              initial={false}
              animate={{ width: progress !== null ? `${progress}%` : '100%' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={progress === null ? { opacity: 0.4 } : undefined}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Progress" value={progress !== null ? `${progress.toFixed(1)}%` : '—'} />
            <Stat label="Speed" value={formatSpeed(job.speedBytesPerSec)} />
            <Stat label="Remaining" value={formatEta(job.downloadedBytes, job.totalBytes, job.speedBytesPerSec)} />
            <Stat
              label="Downloaded"
              value={`${formatBytes(job.downloadedBytes)}${job.totalBytes ? ` / ${formatBytes(job.totalBytes)}` : ''}`}
            />
          </div>
        </div>
      )}

      {job.status === 'completed' && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Download finished successfully.
        </div>
      )}

      {job.status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" />
          {job.error ?? 'This download could not be completed.'}
        </div>
      )}

      {job.status === 'cancelled' && (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <XCircle className="h-4 w-4" />
          Download was cancelled.
        </div>
      )}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 font-semibold text-white">{value}</p>
    </div>
  );
}
