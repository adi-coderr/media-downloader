import { API_BASE_URL, apiRequest } from './client';
import { DownloadJob } from '@/types/media';

export interface CreateDownloadInput {
  sourceUrl: string;
  filename: string;
  streamType: 'video' | 'audio';
  mode?: 'download' | 'clip';
  formatId?: string;
  startTime?: number;
  endTime?: number;
  outputResolution?: string;
}

export function getStreamUrl(sourceUrl: string, filename: string, streamType: 'video' | 'audio' = 'video', mode: 'download' | 'clip' = 'download', formatId?: string, startTime?: number, endTime?: number, outputResolution?: string): string {
  const params = new URLSearchParams({ sourceUrl, filename, streamType, mode });
  if (formatId) params.set('formatId', formatId);
  if (startTime !== undefined) params.set('startTime', startTime.toString());
  if (endTime !== undefined) params.set('endTime', endTime.toString());
  if (outputResolution !== undefined) params.set('outputResolution', outputResolution);
  return `${API_BASE_URL}/downloads/stream?${params.toString()}`;
}

export async function createDownload(input: CreateDownloadInput): Promise<DownloadJob> {
  const response = await fetch(`${API_BASE_URL}/downloads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!response.ok || !response.body) throw new Error('Unable to start the download.');
  const id = response.headers.get('X-Download-Id');
  if (!id) throw new Error('The server did not return a download id.');
  const job: DownloadJob = {
    id, sourceStreamUrl: input.sourceUrl, suggestedFilename: input.filename, status: 'downloading',
    totalBytes: null, downloadedBytes: 0, speedBytesPerSec: 0, startedAt: Date.now(), updatedAt: Date.now(),
  };
  void response.blob().then((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = input.filename; link.click();
    URL.revokeObjectURL(url);
  });
  return job;
}

export async function getDownloadJob(id: string): Promise<DownloadJob> {
  const response = await apiRequest<{ job: DownloadJob }>(`/downloads/${id}`);
  return response.job;
}

