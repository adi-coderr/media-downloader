import { apiRequest } from './client';
import { AnalyzeResponse } from '@/types/media';

export async function analyzeMediaUrl(url: string, signal?: AbortSignal): Promise<AnalyzeResponse> {
  return apiRequest<AnalyzeResponse>('/media/analyze', {
    method: 'POST',
    body: { url },
    signal,
  });
}
