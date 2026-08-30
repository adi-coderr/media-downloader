export type MediaAvailability = 'available' | 'protected' | 'not_found' | 'invalid';

export interface VideoStream {
  formatId: string;
  resolution: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  hasAudio: boolean;
  estimatedSizeBytes: number | null;
  bitrateKbps: number | null;
  directUrl: string;
  protocol: string;
}

export interface AudioStream {
  formatId: string;
  format: string | null;
  audioCodec: string | null;
  bitrateKbps: number | null;
  container: string | null;
  estimatedSizeBytes: number | null;
  directUrl: string;
  protocol: string;
}

export interface MediaMetadata {
  sourceUrl: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  uploader: string | null;
  extractor: string;
  isLive: boolean;
  videoStreams: VideoStream[];
  audioStreams: AudioStream[];
}

export interface AnalyzeResponse {
  success: boolean;
  availability: MediaAvailability;
  media?: MediaMetadata;
  message?: string;
}

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface DownloadJob {
  id: string;
  sourceStreamUrl: string;
  suggestedFilename: string;
  status: DownloadStatus;
  totalBytes: number | null;
  downloadedBytes: number;
  speedBytesPerSec: number;
  startedAt: number;
  updatedAt: number;
  error?: string;
  downloadUrl?: string;
}
