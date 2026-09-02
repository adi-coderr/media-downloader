import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { createDownload, CreateDownloadInput, getDownloadJob } from '@/api/downloadApi';
import { DownloadJob } from '@/types/media';

interface DownloadContextValue {
  jobs: DownloadJob[];
  enqueue: (input: CreateDownloadInput) => Promise<DownloadJob>;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: ReactNode }): JSX.Element {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  const enqueue = async (input: CreateDownloadInput): Promise<DownloadJob> => {
    const job = await createDownload(input);
    setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
    return job;
  };

  useEffect(() => {
    const active = jobs.filter((job) => job.status === 'queued' || job.status === 'downloading');
    if (active.length === 0) return undefined;
    const poll = window.setInterval(() => {
      void Promise.all(active.map(async (job) => {
        try { return await getDownloadJob(job.id); } catch { return job; }
      })).then((updates) => setJobs((current) => current.map((job) => updates.find((update) => update.id === job.id) ?? job)));
    }, 800);
    return () => window.clearInterval(poll);
  }, [jobs]);

  return <DownloadContext.Provider value={{ jobs, enqueue }}>{children}</DownloadContext.Provider>;
}

export function useDownloads(): DownloadContextValue {
  const context = useContext(DownloadContext);
  if (!context) throw new Error('useDownloads must be used inside DownloadProvider');
  return context;
}
