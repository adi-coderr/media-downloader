import dotenv from 'dotenv';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

dotenv.config();

function requireString(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : fallback;
}

function requireNumber(name: string, fallback: number): number {
  const value = process.env[name];
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  port: requireNumber('PORT', 4000),
  nodeEnv: requireString('NODE_ENV', 'development'),
  corsOrigin: requireString('CORS_ORIGIN', 'http://localhost:5173'),
  rateLimitWindowMs: requireNumber('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMaxRequests: requireNumber('RATE_LIMIT_MAX_REQUESTS', 30),
  ytDlpPath: requireString('YTDLP_PATH', 'yt-dlp'),
  ffmpegPath: requireString('FFMPEG_PATH', ffmpegPath || 'ffmpeg'),
  inspectTimeoutMs: requireNumber('INSPECT_TIMEOUT_MS', 25_000),
  downloadMaxConcurrency: requireNumber('DOWNLOAD_MAX_CONCURRENCY', 3),
  downloadStagingDir: path.resolve(
    process.cwd(),
    requireString('DOWNLOAD_STAGING_DIR', './downloads'),
  ),
  isProduction: requireString('NODE_ENV', 'development') === 'production',
};
