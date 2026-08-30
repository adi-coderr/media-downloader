import { API_BASE_URL } from './client';

export function getStreamUrl(
  sourceUrl: string,
  filename: string,
  streamType: 'video' | 'audio' = 'video',
  mode: 'download' | 'clip' = 'download',
  formatId?: string,
  startTime?: number,
  endTime?: number,
  outputResolution?: string,
): string {
  const params = new URLSearchParams({
    sourceUrl,
    filename,
    streamType,
    mode,
  });

  if (formatId) {
    params.set('formatId', formatId);
  }

  if (startTime !== undefined) {
    params.set('startTime', startTime.toString());
  }
  if (endTime !== undefined) {
    params.set('endTime', endTime.toString());
  }
  if (outputResolution !== undefined) {
    params.set('outputResolution', outputResolution);
  }

  return `${API_BASE_URL}/downloads/stream?${params.toString()}`;
}
