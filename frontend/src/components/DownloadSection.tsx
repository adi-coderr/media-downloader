import { CheckCircle2, CircleAlert, Download, LoaderCircle } from 'lucide-react';
import { useDownloads } from '@/context/DownloadContext';

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadSection(): JSX.Element | null {
  const { jobs } = useDownloads();
  if (jobs.length === 0) return null;
  return (
    <section className="mx-auto mt-4 max-w-6xl px-4 sm:px-6" aria-label="Downloads">
      <div className="glass-panel px-5 py-4">
        <div className="mb-3 flex items-center gap-2"><Download className="h-4 w-4 text-primary" /><h2 className="font-semibold text-white">Downloads</h2></div>
        <div className="space-y-4">
          {jobs.map((job) => {
            const progress = job.totalBytes ? Math.min(100, (job.downloadedBytes / job.totalBytes) * 100) : 0;
            const active = job.status === 'queued' || job.status === 'downloading';
            return <div key={job.id}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="truncate text-white/80">{job.suggestedFilename}</span><span className="shrink-0 text-white/50">{job.status === 'completed' ? 'Ready' : job.status === 'error' ? 'Failed' : job.totalBytes ? `${progress.toFixed(0)}%` : 'Preparing...'}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full transition-[width] duration-500 ${job.status === 'error' ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${job.status === 'completed' ? 100 : progress}%` }} /></div>
              <div className="mt-1 flex items-center gap-2 text-xs text-white/45">{active && <LoaderCircle className="h-3 w-3 animate-spin" />}{job.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-success" />}{job.status === 'error' && <CircleAlert className="h-3 w-3 text-danger" />}<span>{job.totalBytes ? `${formatBytes(job.downloadedBytes)} of ${formatBytes(job.totalBytes)}` : 'Streaming media...'}</span></div>
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}