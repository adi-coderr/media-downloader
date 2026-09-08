import { createContext, ReactNode, useContext } from 'react';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import { DownloadJob } from '@/types/media';

interface DownloadContextValue {
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

const DownloadContext = createContext<DownloadContextValue | undefined>(undefined);

export function DownloadProvider({ children }: { children: ReactNode }): JSX.Element {
  const manager = useDownloadManager();
  return <DownloadContext.Provider value={manager}>{children}</DownloadContext.Provider>;
}

export function useDownloads(): DownloadContextValue {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
}
