import { ChildProcess, execFile } from 'child_process';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { DownloadJob } from '../types/media.types';

/**
 * Manages server-staged downloads of direct media stream URLs that were
 * already exposed as publicly downloadable by the source (via the
 * inspection step). This service only ever fetches URLs the source itself
 * served back to us — it performs no authentication bypass, no decryption,
 * and no access-control circumvention.
 */

type DownloadKind = 'video' | 'audio';
type DownloadMode = 'download' | 'clip';

interface InternalJob extends DownloadJob {
  abortController: AbortController;
  process?: ChildProcess;
  filePath: string;
  paused: boolean;
  sourceUrl: string;
  streamUrl: string;
  kind: DownloadKind;
  formatId?: string;
  mode: DownloadMode;
  startTime?: number | null;
  endTime?: number | null;
  outputResolution?: string | null;
}

const jobs = new Map<string, InternalJob>();
let activeDownloads = 0;
const queue: string[] = [];

function ensureStagingDir(): void {
  if (!fs.existsSync(env.downloadStagingDir)) {
    fs.mkdirSync(env.downloadStagingDir, { recursive: true });
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'download';
}

function toPublicJob(job: InternalJob): DownloadJob {
  const { abortController: _abortController, filePath: _filePath, paused: _paused, ...publicJob } = job;
  return publicJob;
}

async function processQueue(): Promise<void> {
  if (activeDownloads >= env.downloadMaxConcurrency) {
    return;
  }
  const nextId = queue.shift();
  if (!nextId) {
    return;
  }
  const job = jobs.get(nextId);
  if (!job || job.status !== 'queued') {
    void processQueue();
    return;
  }
  activeDownloads += 1;
  void runDownload(job).finally(() => {
    activeDownloads -= 1;
    void processQueue();
  });
}

function parseSize(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  const match = normalized.match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB|kB|MB|GB|TB)$/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    b: 1,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
    tb: 1000 ** 4,
  };

  return Number.isFinite(amount) ? amount * (multipliers[unit] ?? 1) : null;
}

function parseEta(value: string): number | null {
  if (!value || value.toLowerCase() === 'unknown' || value.toLowerCase() === 'n/a') {
    return null;
  }

  const parts = value.split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0];
}

export function parseProgressLine(line: string): {
  downloadedBytes?: number;
  totalBytes?: number | null;
  speedBytesPerSec?: number | null;
  etaSeconds?: number | null;
  progressPercent?: number | null;
  filename?: string;
  status?: string;
} | null {
  const normalized = line.trim();

  // 1. Check for JSON progress output from --progress-template "download:%(progress)j"
  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    try {
      const data = JSON.parse(normalized);
      if (data && typeof data === 'object') {
        const total = (typeof data.total_bytes === 'number' && data.total_bytes > 0)
          ? data.total_bytes
          : (typeof data.total_bytes_estimate === 'number' && data.total_bytes_estimate > 0)
          ? data.total_bytes_estimate
          : null;

        const downloadedBytes = typeof data.downloaded_bytes === 'number' && data.downloaded_bytes >= 0
          ? data.downloaded_bytes
          : undefined;

        // Compute percent reliably: either from downloaded/total or parse _percent_str
        let progressPercent: number | null = null;
        if (typeof total === 'number' && total > 0 && typeof downloadedBytes === 'number') {
          progressPercent = Math.min(100, Math.max(0, (downloadedBytes / total) * 100));
        } else if (typeof data._percent_str === 'string') {
          const parsed = parseFloat(data._percent_str.replace('%', '').trim());
          if (Number.isFinite(parsed)) {
            progressPercent = parsed;
          }
        }

        return {
          downloadedBytes,
          totalBytes: total,
          speedBytesPerSec: typeof data.speed === 'number' && data.speed >= 0 ? data.speed : null,
          etaSeconds: typeof data.eta === 'number' && data.eta >= 0 ? data.eta : null,
          progressPercent,
          filename: typeof data.filename === 'string' ? data.filename : undefined,
          status: typeof data.status === 'string' ? data.status : undefined,
        };
      }
    } catch {
      // Fall through to regex if JSON.parse fails
    }
  }

  const explicitRegex = /downloaded_bytes:(?<downloadedBytes>-?\d+) total_bytes:(?<totalBytes>-?\d+) speed:(?<speed>[^\s]+) eta:(?<eta>[^\s]+) progress:(?<progress>[\d.]+)/;
  const explicitMatch = normalized.match(explicitRegex);

  if (explicitMatch?.groups) {
    const downloadedBytes = Number(explicitMatch.groups.downloadedBytes);
    const totalBytesRaw = Number(explicitMatch.groups.totalBytes);
    const totalBytes = Number.isFinite(totalBytesRaw) && totalBytesRaw >= 0 ? totalBytesRaw : null;
    const speedBytesPerSec = parseSize(explicitMatch.groups.speed.replace(/\/s$/, ''));
    const etaSeconds = parseEta(explicitMatch.groups.eta);
    const progressPercent = Number(explicitMatch.groups.progress);

    return {
      downloadedBytes: Number.isFinite(downloadedBytes) && downloadedBytes >= 0 ? downloadedBytes : undefined,
      totalBytes,
      speedBytesPerSec,
      etaSeconds,
      progressPercent: Number.isFinite(progressPercent) ? progressPercent : null,
    };
  }

  const legacyRegex = /\[download\]\s+(?<percent>[\d.]+)% of\s+(?<size>[^\s]+)\s+at\s+(?<speed>[^\s]+)\s+ETA\s+(?<eta>[^\s]+)/i;
  const legacyMatch = normalized.match(legacyRegex);
  if (!legacyMatch?.groups) {
    return null;
  }

  const progressPercent = Number(legacyMatch.groups.percent);
  const totalBytes = parseSize(legacyMatch.groups.size);
  const downloadedBytes = totalBytes !== null && Number.isFinite(progressPercent)
    ? Math.round((progressPercent / 100) * totalBytes)
    : undefined;
  const speedBytesPerSec = parseSize(legacyMatch.groups.speed.replace(/\/s$/, ''));
  const etaSeconds = parseEta(legacyMatch.groups.eta);

  return {
    downloadedBytes,
    totalBytes,
    speedBytesPerSec,
    etaSeconds,
    progressPercent: Number.isFinite(progressPercent) ? progressPercent : null,
  };
}

async function runDownload(job: InternalJob): Promise<void> {
  job.status = 'downloading';
  job.updatedAt = Date.now();

  // Create a unique per-job staging subdirectory so intermediate files
  // (e.g. .f398.mp4, .f251.webm) don't clash with other jobs.
  const jobTempDir = path.join(env.downloadStagingDir, `tmp_${job.id}`);
  fs.mkdirSync(jobTempDir, { recursive: true });

  try {
    const outputExtension = job.kind === 'audio' ? 'm4a' : 'mp4';
    const outputPath = job.filePath;

    // IMPORTANT: Do NOT use job.formatId for the download format selector.
    // The formatId from the inspect phase references a pre-signed CDN URL that
    // expires within minutes. Passing it causes yt-dlp to try that stale URL
    // directly, resulting in HTTP 403 Forbidden errors.
    //
    // Format selector strategy for video:
    // 1. Prefer mp4/H.264 video + m4a audio → most compatible, avoids WebM 403s
    // 2. Fall back to best video+audio of any format
    // 3. Last resort: any single combined format
    const formatSelector = job.kind === 'video'
      ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/bestvideo+bestaudio[ext=m4a]/bestvideo+bestaudio/best'
      : 'bestaudio[ext=m4a]/bestaudio/best';

    // Use a simple filename inside the per-job temp dir.
    // yt-dlp will place its intermediate per-format files here as well.
    const tempOutputTemplate = path.join(jobTempDir, `output.%(ext)s`);

    const commonArgs = [
      '--no-warnings',
      '--no-playlist',
      '--newline',
      '--socket-timeout', '30',
      '--retries', '3',
      '--continue',
      '--progress-template',
      'download:%(progress)j',
      '--ffmpeg-location',
      env.ffmpegPath,
      '--output',
      tempOutputTemplate,
    ];

    const formatArgs: string[] = job.kind === 'video'
      ? ['--format', formatSelector, '--merge-output-format', 'mp4', '--recode-video', 'mp4']
      : ['--format', formatSelector, '--extract-audio', '--audio-format', 'm4a', '--audio-quality', '0'];

    const args = [...commonArgs, ...formatArgs, job.sourceUrl];

    const MAX_RETRIES = 5;
    let attempt = 0;
    let success = false;
    let lastError: Error | null = null;

    while (attempt < MAX_RETRIES && !success) {
      if (job.abortController.signal.aborted || job.paused) {
        break;
      }

      attempt++;
      if (attempt > 1) {
        logger.info(`Retrying download (attempt ${attempt}/${MAX_RETRIES}) due to failure...`, { jobId: job.id });
        // small backoff
        await new Promise((res) => setTimeout(res, 2000));
        if (job.abortController.signal.aborted || job.paused) {
          break;
        }
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const child = execFile(env.ytDlpPath, args, { maxBuffer: 1024 * 1024 * 64 }, (error, _stdout, stderr) => {
            job.process = undefined;
            if (job.abortController.signal.aborted || job.paused) {
              reject(new Error(job.paused ? 'Download paused' : 'Download cancelled'));
              return;
            }
            if (error) {
              reject(new Error(stderr.trim() || error.message));
              return;
            }
            resolve();
          });

          job.process = child;

          const streamMap = new Map<string, { downloaded: number; total: number | null }>();

          // Pre-populate streamMap with any intermediate stream files that already finished downloading
          if (fs.existsSync(jobTempDir)) {
            try {
              const existingFiles = fs.readdirSync(jobTempDir);
              for (const file of existingFiles) {
                if (!file.endsWith('.part') && !file.endsWith('.ytdl')) {
                  const fullPath = path.join(jobTempDir, file);
                  const stat = fs.statSync(fullPath);
                  if (stat.isFile() && stat.size > 0) {
                    streamMap.set(file, { downloaded: stat.size, total: stat.size });
                  }
                }
              }
              if (streamMap.size > 0) {
                let initDownloaded = 0;
                for (const s of streamMap.values()) {
                  initDownloaded += s.downloaded;
                }
                if (initDownloaded > job.downloadedBytes) {
                  job.downloadedBytes = initDownloaded;
                }
              }
            } catch {
              // Ignore stat error
            }
          }

          const processChunk = (data: string, bufferRef: { value: string }): void => {
            bufferRef.value += data;
            let delimiterMatch: RegExpMatchArray | null;
            while ((delimiterMatch = bufferRef.value.match(/[\r\n]+/))) {
              const idx = delimiterMatch.index!;
              const line = bufferRef.value.slice(0, idx).trim();
              bufferRef.value = bufferRef.value.slice(idx + delimiterMatch[0].length);
              if (!line) {
                continue;
              }

              if (
                line.includes('[Merger]') ||
                line.includes('[ExtractAudio]') ||
                line.includes('[Fixup') ||
                line.includes('[VideoConvertor]')
              ) {
                job.status = 'processing';
                job.speedBytesPerSec = 0;
                job.etaSeconds = null;
                job.updatedAt = Date.now();
                continue;
              }

              const alreadyDownloadedMatch = line.match(/\[download\]\s+(.+?)\s+has already been downloaded/i);
              if (alreadyDownloadedMatch) {
                const filePathOrName = alreadyDownloadedMatch[1];
                const filename = path.basename(filePathOrName);
                const streamKey = filename || 'default';
                try {
                  const fullPath = path.isAbsolute(filePathOrName) ? filePathOrName : path.join(jobTempDir, filename);
                  if (fs.existsSync(fullPath)) {
                    const stat = fs.statSync(fullPath);
                    streamMap.set(streamKey, { downloaded: stat.size, total: stat.size });
                    let aggregateDownloaded = 0;
                    for (const s of streamMap.values()) {
                      aggregateDownloaded += s.downloaded;
                    }
                    if (aggregateDownloaded > job.downloadedBytes) {
                      job.downloadedBytes = aggregateDownloaded;
                    }
                    job.updatedAt = Date.now();
                  }
                } catch {
                  // Ignore error
                }
                continue;
              }

              const progress = parseProgressLine(line);
              if (!progress) {
                continue;
              }

              const streamKey = progress.filename || 'default';
              const currentStream = streamMap.get(streamKey) || { downloaded: 0, total: null };

              if (progress.downloadedBytes !== undefined) {
                currentStream.downloaded = progress.downloadedBytes;
              }
              if (progress.totalBytes !== undefined && progress.totalBytes !== null) {
                currentStream.total = progress.totalBytes;
              }
              if (progress.status === 'finished' && currentStream.total !== null) {
                currentStream.downloaded = currentStream.total;
              }
              streamMap.set(streamKey, currentStream);

              let aggregateDownloaded = 0;
              let aggregateTotal: number | null = 0;
              for (const s of streamMap.values()) {
                aggregateDownloaded += s.downloaded;
                if (s.total === null) {
                  aggregateTotal = null;
                } else if (aggregateTotal !== null) {
                  aggregateTotal += s.total;
                }
              }

              job.downloadedBytes = aggregateDownloaded;
              job.totalBytes = aggregateTotal;

              if (progress.speedBytesPerSec !== undefined && progress.speedBytesPerSec !== null) {
                job.speedBytesPerSec = progress.speedBytesPerSec;
              }
              if (progress.etaSeconds !== undefined) {
                job.etaSeconds = progress.etaSeconds;
              }
              job.updatedAt = Date.now();
            }
          };

          const stderrBuffer = { value: '' };
          const stdoutBuffer = { value: '' };

          child.stderr?.setEncoding('utf8');
          child.stderr?.on('data', (chunk: string) => processChunk(chunk, stderrBuffer));
          child.stdout?.setEncoding('utf8');
          child.stdout?.on('data', (chunk: string) => processChunk(chunk, stdoutBuffer));

          job.abortController.signal.addEventListener('abort', () => {
            if (!child.killed) {
              child.kill('SIGTERM');
            }
          }, { once: true });
        });

        success = true;
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || '';
        // If it's a 403 or connection reset, yt-dlp can resume the `.part` file on the next attempt.
        if (job.abortController.signal.aborted || job.paused) {
          throw err;
        }
        if (!errMsg.includes('403') && !errMsg.includes('Forbidden') && !errMsg.includes('reset by peer')) {
          // If it's some other fatal error, don't retry
          throw err;
        }
      }
    }

    if (!success) {
      throw lastError || new Error('Download failed after retries');
    }

    // Scan the temp dir for the final merged output file.
    // yt-dlp may write output.mp4, output.webm, output.m4a etc.
    // Skip intermediate per-format files (output.f251.webm) and .part files.
    const entries = fs.readdirSync(jobTempDir);
    const finalFile = entries.find(
      (f) => f.startsWith('output.') && !f.endsWith('.part') && !/\.f\d+\./.test(f),
    );

    if (!finalFile) {
      logger.error('No output file found in temp dir', { jobTempDir, entries, jobId: job.id });
      throw new AppError('The selected media could not be produced.', 500);
    }

    let resolvedTempPath = path.join(jobTempDir, finalFile);
    logger.info('yt-dlp finished download', { resolvedTempPath, outputPath, jobId: job.id });

    let finalPath = resolvedTempPath;

    if (job.mode === 'clip' && job.kind === 'video') {
      job.status = 'processing';
      job.speedBytesPerSec = 0;
      job.etaSeconds = null;
      job.updatedAt = Date.now();

      const clipStart = Math.max(0, job.startTime ?? 0);
      const clipEnd = Math.max(clipStart + 0.1, job.endTime ?? clipStart + 0.1);
      const clipDuration = Math.max(0.1, clipEnd - clipStart);
      const resolutionFilter = job.outputResolution && job.outputResolution !== 'original'
        ? `scale=-2:${String(job.outputResolution).replace(/p$/i, '')}`
        : null;

      const clipOutputPath = path.join(jobTempDir, `clip.${outputExtension}`);
      const clipArgs = [
        '-y',
        '-ss',
        String(clipStart),
        '-i',
        resolvedTempPath,
        '-t',
        String(clipDuration),
        ...(resolutionFilter ? ['-vf', resolutionFilter] : []),
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+faststart',
        clipOutputPath,
      ];

      await new Promise<void>((resolve, reject) => {
        const child = execFile(env.ffmpegPath, clipArgs, { maxBuffer: 1024 * 1024 * 64 }, (error, _stdout, stderr) => {
          job.process = undefined;
          if (job.abortController.signal.aborted || job.paused) {
            reject(new Error(job.paused ? 'Download paused' : 'Download cancelled'));
            return;
          }
          if (error) {
            reject(new Error(stderr.trim() || error.message));
            return;
          }
          resolve();
        });

        job.process = child;
        job.abortController.signal.addEventListener('abort', () => {
          if (!child.killed) {
            child.kill('SIGTERM');
          }
        }, { once: true });
      });
      finalPath = clipOutputPath;
      logger.info('ffmpeg clip completed', { clipStart, clipDuration, finalPath, jobId: job.id });
    }

    if (!fs.existsSync(finalPath)) {
      logger.error('Final produced file missing', { finalPath, jobId: job.id });
      throw new AppError('The selected media could not be produced.', 500);
    }

    // Move the produced file into the final job.filePath atomically
    try {
      fs.renameSync(finalPath, job.filePath);
    } catch (err) {
      logger.error('Rename failed, attempting copy fallback', { err: String(err), finalPath, target: job.filePath, jobId: job.id });
      await fsPromises.copyFile(finalPath, job.filePath).catch((copyErr) => {
        logger.error('Copy fallback failed', { err: String(copyErr), finalPath, target: job.filePath, jobId: job.id });
      });
    }

    logger.info('Download job completed', { jobId: job.id, filePath: job.filePath });

    job.status = 'completed';
    job.speedBytesPerSec = 0;
    job.etaSeconds = 0;
    job.updatedAt = Date.now();
  } catch (error) {
    if (job.paused || (job.status as string) === 'paused') {
      job.status = 'paused';
      job.speedBytesPerSec = 0;
      job.etaSeconds = null;
    } else if (job.abortController.signal.aborted) {
      job.status = 'cancelled';
      job.speedBytesPerSec = 0;
      job.etaSeconds = null;
    } else {
      const message = error instanceof Error ? error.message : String(error);
      job.status = 'error';
      job.error = message;
      logger.error('Download failed', { jobId: job.id, message });
    }
    job.updatedAt = Date.now();
  } finally {
    // Clean up the per-job temp directory unless the job is paused
    if (!job.paused && (job.status as string) !== 'paused') {
      fsPromises.rm(jobTempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}



export function createDownloadJob(
  sourceUrl: string,
  streamUrl: string,
  filename: string,
  kind: DownloadKind = 'video',
  formatId?: string,
  mode: DownloadMode = 'download',
  startTime?: number,
  endTime?: number,
  outputResolution?: string,
): DownloadJob {
  ensureStagingDir();

  const id = nanoid(12);
  const providedExt = path.extname(filename);
  const defaultExt = kind === 'audio' ? '.m4a' : '.mp4';
  const ext = providedExt || defaultExt;
  const baseName = sanitizeFilename(path.basename(filename, providedExt || ''));
  const suggestedFilename = `${baseName}${ext}`;
  const filePath = path.join(env.downloadStagingDir, `${id}-${baseName}${ext}`);

  const job: InternalJob = {
    id,
    sourceStreamUrl: streamUrl,
    suggestedFilename,
    status: 'queued',
    totalBytes: null,
    downloadedBytes: 0,
    speedBytesPerSec: 0,
    etaSeconds: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    abortController: new AbortController(),
    filePath,
    paused: false,
    sourceUrl,
    streamUrl,
    kind,
    formatId,
    mode,
    startTime,
    endTime,
    outputResolution,
  };

  jobs.set(id, job);
  queue.push(id);
  void processQueue();

  return toPublicJob(job);
}

export function getDownloadJob(id: string): DownloadJob | null {
  const job = jobs.get(id);
  return job ? toPublicJob(job) : null;
}

export function listDownloadJobs(): DownloadJob[] {
  return Array.from(jobs.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(toPublicJob);
}

export function pauseDownloadJob(id: string): DownloadJob {
  const job = jobs.get(id);
  if (!job) {
    throw new AppError('Download job not found.', 404);
  }
  if (job.status !== 'downloading' && job.status !== 'queued') {
    throw new AppError('Only active or queued downloads can be paused.', 409);
  }
  job.paused = true;
  job.status = 'paused';
  job.speedBytesPerSec = 0;
  job.etaSeconds = null;
  job.updatedAt = Date.now();

  const queueIdx = queue.indexOf(id);
  if (queueIdx !== -1) {
    queue.splice(queueIdx, 1);
  }

  job.abortController.abort();
  if (job.process && !job.process.killed) {
    job.process.kill('SIGTERM');
  }
  job.process = undefined;
  return toPublicJob(job);
}

export function resumeDownloadJob(id: string): DownloadJob {
  const job = jobs.get(id);
  if (!job) {
    throw new AppError('Download job not found.', 404);
  }
  if (job.status !== 'paused') {
    throw new AppError('Only paused downloads can be resumed.', 409);
  }
  job.paused = false;
  job.status = 'queued';
  job.abortController = new AbortController();
  job.updatedAt = Date.now();
  if (!queue.includes(id)) {
    queue.push(id);
  }
  void processQueue();
  return toPublicJob(job);
}

export function cancelDownloadJob(id: string): DownloadJob {
  const job = jobs.get(id);
  if (!job) {
    throw new AppError('Download job not found.', 404);
  }
  if (job.status === 'completed' || job.status === 'cancelled') {
    return toPublicJob(job);
  }
  job.paused = false;

  const queueIdx = queue.indexOf(id);
  if (queueIdx !== -1) {
    queue.splice(queueIdx, 1);
  }

  job.abortController.abort();
  if (job.process && !job.process.killed) {
    job.process.kill('SIGTERM');
  }
  job.process = undefined;
  job.status = 'cancelled';
  job.speedBytesPerSec = 0;
  job.etaSeconds = null;
  job.updatedAt = Date.now();

  void fsPromises.unlink(job.filePath).catch(() => undefined);

  const jobTempDir = path.join(env.downloadStagingDir, `tmp_${job.id}`);
  void fsPromises.rm(jobTempDir, { recursive: true, force: true }).catch(() => undefined);

  return toPublicJob(job);
}

export function getDownloadFilePath(id: string): { filePath: string; filename: string } {
  const job = jobs.get(id);
  if (!job) {
    throw new AppError('Download job not found.', 404);
  }
  if (job.status !== 'completed') {
    throw new AppError('This download has not completed yet.', 409);
  }
  return { filePath: job.filePath, filename: job.suggestedFilename };
}

// Background task to clean up old downloads after 10 minutes (and abandoned paused jobs after 1 hour)
setInterval(() => {
  const now = Date.now();
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  
  for (const [id, job] of jobs.entries()) {
    const isFinished = ['completed', 'cancelled', 'error'].includes(job.status);
    const isAbandonedPaused = job.status === 'paused' && (now - job.updatedAt > ONE_HOUR_MS);

    if ((isFinished && now - job.updatedAt > TEN_MINUTES_MS) || isAbandonedPaused) {
      jobs.delete(id);
      
      // Remove the downloaded file if it exists
      if (job.filePath && fs.existsSync(job.filePath)) {
        fsPromises.unlink(job.filePath).catch((err) => {
          logger.error('Failed to cleanup stale download file', { id, err: String(err) });
        });
      }

      // Remove the per-job temp directory if it exists
      const jobTempDir = path.join(env.downloadStagingDir, `tmp_${id}`);
      if (fs.existsSync(jobTempDir)) {
        fsPromises.rm(jobTempDir, { recursive: true, force: true }).catch((err) => {
          logger.error('Failed to cleanup stale temp directory', { id, err: String(err) });
        });
      }
    }
  }
}, 60 * 1000); // Run check every 1 minute
