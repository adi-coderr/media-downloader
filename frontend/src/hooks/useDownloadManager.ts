import { useCallback, useEffect, useState } from 'react';
import {
  cancelDownload as cancelDownloadApi,
  getDownloadFileUrl,
  listDownloads,
  pauseDownload as pauseDownloadApi,
  resumeDownload as resumeDownloadApi,
  startDownload as startDownloadApi,
} from '@/api/downloadApi';
import { DownloadJob } from '@/types/media';
import { useToast } from '@/context/ToastContext';

const POLL_INTERVAL_MS = 2000;

/** Persist notified job IDs in sessionStorage so toast deduplication
 *  survives React re-renders but resets when the tab is closed. */
function getNotifiedSet(key: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function addToNotifiedSet(key: string, id: string): void {
  try {
    const set = getNotifiedSet(key);
    set.add(id);
    sessionStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // sessionStorage unavailable — fall back silently
  }
}

interface UseDownloadManagerResult {
  jobs: DownloadJob[];
  startNewDownload: (
    sourceUrl: string,
    streamUrl: string,
    filename: string,
    streamType?: 'video' | 'audio',
    formatId?: string,
    mode?: 'download' | 'clip',
    startTime?: number,
    endTime?: number,
    outputResolution?: string,
  ) => Promise<void>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
}

export function useDownloadManager(): UseDownloadManagerResult {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const { showToast } = useToast();

  const refreshJobs = useCallback(async () => {
    try {
      const latestJobs = await listDownloads();
      setJobs(latestJobs);

      const notifiedCompletion = getNotifiedSet('notified_completion');
      const notifiedError = getNotifiedSet('notified_error');

      for (const job of latestJobs) {
        if (job.status === 'completed' && !notifiedCompletion.has(job.id)) {
          addToNotifiedSet('notified_completion', job.id);
          showToast('Download complete', job.suggestedFilename, 'success');
        }
        if (job.status === 'error' && !notifiedError.has(job.id)) {
          addToNotifiedSet('notified_error', job.id);
          showToast('Download failed', job.error ?? 'The download could not be completed.', 'error');
        }
      }
    } catch {
      // Silently skip a failed poll cycle; the next interval will retry.
    }
  }, [showToast]);

  useEffect(() => {
    void refreshJobs();
    const interval = window.setInterval(() => {
      void refreshJobs();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshJobs]);

  const startNewDownload = useCallback(
    async (
      sourceUrl: string,
      streamUrl: string,
      filename: string,
      streamType: 'video' | 'audio' = 'video',
      formatId?: string,
      mode: 'download' | 'clip' = 'download',
      startTime?: number,
      endTime?: number,
      outputResolution?: string,
    ) => {
      const job = await startDownloadApi(
        sourceUrl,
        streamUrl,
        filename,
        streamType,
        formatId,
        mode,
        startTime,
        endTime,
        outputResolution,
      );
      setJobs((prev) => [job, ...prev]);
      showToast('Download started', filename, 'info');
    },
    [showToast],
  );

  const pause = useCallback(async (id: string) => {
    const job = await pauseDownloadApi(id);
    setJobs((prev) => prev.map((existing) => (existing.id === id ? job : existing)));
  }, []);

  const resume = useCallback(async (id: string) => {
    const job = await resumeDownloadApi(id);
    setJobs((prev) => prev.map((existing) => (existing.id === id ? job : existing)));
  }, []);

  const cancel = useCallback(async (id: string) => {
    const job = await cancelDownloadApi(id);
    setJobs((prev) => prev.map((existing) => (existing.id === id ? job : existing)));
  }, []);

  return { jobs, startNewDownload, pause, resume, cancel };
}

export function useDownloadFileUrl(): (id: string) => string {
  return getDownloadFileUrl;
}
