export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) {
    return 'Unknown size';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return 'Unknown';
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatSpeed(bytesPerSec: number | null | undefined): string {
  if (!bytesPerSec || bytesPerSec <= 0) {
    return '—';
  }
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(downloadedBytes: number, totalBytes: number | null, speedBytesPerSec: number): string {
  if (!totalBytes || speedBytesPerSec <= 0) {
    return '—';
  }
  const remainingBytes = totalBytes - downloadedBytes;
  if (remainingBytes <= 0) {
    return '0s';
  }
  const remainingSeconds = Math.ceil(remainingBytes / speedBytesPerSec);
  if (remainingSeconds < 60) {
    return `${remainingSeconds}s`;
  }
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isLikelyValidUrl(value: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function truncateFilename(filename: string, maxLength = 40): string {
  if (filename.length <= maxLength) {
    return filename;
  }
  const extensionMatch = filename.match(/\.[^.]+$/);
  const extension = extensionMatch ? extensionMatch[0] : '';
  const base = filename.slice(0, maxLength - extension.length - 1);
  return `${base}…${extension}`;
}
