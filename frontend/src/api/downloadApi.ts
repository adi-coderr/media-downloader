import { apiRequest, API_BASE_URL, getOrCreateSessionId } from './client';
import { DownloadJob } from '@/types/media';

interface JobResponse {
  success: boolean;
  job: DownloadJob;
}

interface JobListResponse {
  success: boolean;
  jobs: DownloadJob[];
}

export async function startDownload(
  sourceUrl: string,
  streamUrl: string,
  filename: string,
  streamType: 'video' | 'audio' = 'video',
  formatId?: string,
  mode: 'download' | 'clip' = 'download',
  startTime?: number,
  endTime?: number,
  outputResolution?: string,
): Promise<DownloadJob> {
  const response = await apiRequest<JobResponse>('/downloads', {
    method: 'POST',
    body: { sourceUrl, streamUrl, filename, streamType, formatId, mode, startTime, endTime, outputResolution },
  });
  return response.job;
}

export async function getDownload(id: string): Promise<DownloadJob> {
  const response = await apiRequest<JobResponse>(`/downloads/${id}`);
  return response.job;
}

export async function listDownloads(): Promise<DownloadJob[]> {
  const response = await apiRequest<JobListResponse>('/downloads');
  return response.jobs;
}

export async function pauseDownload(id: string): Promise<DownloadJob> {
  const response = await apiRequest<JobResponse>(`/downloads/${id}/pause`, { method: 'POST' });
  return response.job;
}

export async function resumeDownload(id: string): Promise<DownloadJob> {
  const response = await apiRequest<JobResponse>(`/downloads/${id}/resume`, { method: 'POST' });
  return response.job;
}

export async function cancelDownload(id: string): Promise<DownloadJob> {
  const response = await apiRequest<JobResponse>(`/downloads/${id}/cancel`, { method: 'POST' });
  return response.job;
}

export function getDownloadFileUrl(id: string): string {
  return `${API_BASE_URL}/downloads/${id}/file?sessionId=${encodeURIComponent(getOrCreateSessionId())}`;
}
