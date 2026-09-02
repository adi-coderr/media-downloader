import { spawn } from 'child_process';
import { Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { DownloadJob } from '../types/media.types';

const jobs = new Map<string, DownloadJob & { filePath?: string; child?: ReturnType<typeof spawn> }>();

export function createDownloadJob(
  sourceUrl: string, filename: string, kind: 'video' | 'audio', mode: 'download' | 'clip',
  formatId?: string, startTime?: number, endTime?: number, outputResolution?: string,
): DownloadJob {
  const id = nanoid(12);
  const now = Date.now();
  const job: DownloadJob & { filePath?: string; child?: ReturnType<typeof spawn> } = {
    id, sourceStreamUrl: sourceUrl, suggestedFilename: filename, status: 'queued',
    totalBytes: null, downloadedBytes: 0, speedBytesPerSec: 0, startedAt: now, updatedAt: now,
    mode, startTime, endTime, outputResolution,
  };
  jobs.set(id, job);
  void runDownloadJob(job, sourceUrl, filename, kind, mode, formatId, startTime, endTime);
  return publicJob(job);
}

export function getDownloadJob(id: string): DownloadJob | undefined {
  const job = jobs.get(id);
  return job ? publicJob(job) : undefined;
}

export function getDownloadFile(id: string): { job: DownloadJob; filePath: string } | undefined {
  const job = jobs.get(id);
  if (!job || job.status !== 'completed' || !job.filePath) return undefined;
  return { job: publicJob(job), filePath: job.filePath };
}

function publicJob(job: DownloadJob): DownloadJob {
  const { child: _child, filePath: _filePath, ...safeJob } = job as DownloadJob & { child?: unknown; filePath?: string };
  return safeJob;
}

async function runDownloadJob(
  job: DownloadJob & { filePath?: string; child?: ReturnType<typeof spawn> },
  sourceUrl: string, filename: string, kind: 'video' | 'audio', mode: 'download' | 'clip',
  formatId?: string, startTime?: number, endTime?: number,
): Promise<void> {
  const ext = kind === 'audio' ? 'm4a' : 'mp4';
  const safeName = filename.replace(/\.[^/.]+$/, '') + `.${ext}`;
  const formatSelector = kind === 'audio'
    ? formatId ?? 'bestaudio[ext=m4a]/bestaudio/best'
    : formatId ? `${formatId}+bestaudio/${formatId}` : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
  fs.mkdirSync(env.downloadStagingDir, { recursive: true });
  const tempFile = path.join(env.downloadStagingDir, `${job.id}.${ext}`);
  const args = [
    '-f', formatSelector, '--no-warnings', '--newline',
    '--progress-template', 'download:%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.speed)s',
    '--ffmpeg-location', env.ffmpegPath, '--extractor-args', 'youtube:player_client=web_embedded,mweb,tv',
    '--downloader', 'aria2c', '--downloader-args', 'aria2c:-x 16 -s 16 -k 1M', '--merge-output-format', ext, '-o', tempFile,
  ];
  if (mode === 'clip' && startTime !== undefined) {
    args.push('--download-sections', `*${Math.max(0, startTime)}-${Math.max(startTime + 0.1, endTime ?? startTime + 0.1)}`);
  }
  args.push(sourceUrl);
  job.status = 'downloading';
  job.updatedAt = Date.now();
  const child = spawn(env.ytDlpPath, args);
  job.child = child;
  let output = '';
  child.stdout.on('data', (data: Buffer) => {
    output += data.toString();
    const lines = output.split(/\r?\n/);
    output = lines.pop() ?? '';
    for (const line of lines) {
      const match = line.match(/^download:(\d+)\|([^|]+)\|([^|]+)$/);
      if (!match) continue;
      const downloaded = Number(match[1]);
      const total = Number(match[2]);
      const speed = Number(match[3]);
      if (Number.isFinite(downloaded)) job.downloadedBytes = downloaded;
      if (Number.isFinite(total) && total > 0) job.totalBytes = total;
      if (Number.isFinite(speed) && speed > 0) job.speedBytesPerSec = speed;
      job.updatedAt = Date.now();
    }
  });
  child.stderr.on('data', (data: Buffer) => logger.warn('yt-dlp stderr', { data: data.toString().trim(), jobId: job.id }));
  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('close', resolve);
    child.on('error', () => resolve(1));
  });
  job.child = undefined;
  if (exitCode !== 0) {
    job.status = 'error'; job.error = 'The media download failed.'; job.updatedAt = Date.now(); cleanupTempFiles(tempFile); return;
  }
  const actualFile = findOutputFile(tempFile, job.id, env.downloadStagingDir);
  if (!actualFile) { job.status = 'error'; job.error = 'Downloaded file was not found.'; job.updatedAt = Date.now(); return; }
  job.filePath = actualFile;
  job.downloadedBytes = fs.statSync(actualFile).size;
  job.totalBytes = job.downloadedBytes;
  job.status = 'completed'; job.updatedAt = Date.now(); job.suggestedFilename = safeName;
}

export async function streamMedia(
  res: Response,
  sourceUrl: string,
  filename: string,
  kind: 'video' | 'audio',
  mode: 'download' | 'clip',
  formatId?: string,
  startTime?: number,
  endTime?: number,
  _outputResolution?: string,
): Promise<void> {
  const ext = kind === 'audio' ? 'm4a' : 'mp4';
  const safeName = filename.replace(/\.[^/.]+$/, '') + `.${ext}`;

  let formatSelector: string;
  if (kind === 'audio') {
    formatSelector = formatId ?? 'bestaudio[ext=m4a]/bestaudio/best';
  } else if (formatId) {
    formatSelector = `${formatId}+bestaudio/${formatId}`;
  } else {
    formatSelector = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
  }

  logger.info('streamMedia', { formatId, kind, formatSelector, mode });

  // Send download headers IMMEDIATELY so the browser shows the download bar
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  logger.info('Response headers flushed — browser download bar should appear');

  // Ensure staging dir exists
  if (!fs.existsSync(env.downloadStagingDir)) {
    fs.mkdirSync(env.downloadStagingDir, { recursive: true });
  }

  const tempId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempFile = path.join(env.downloadStagingDir, `${tempId}.${ext}`);

  const downloadArgs = [
    '-f', formatSelector,
    '--no-warnings',
    '--ffmpeg-location', env.ffmpegPath,
    '--extractor-args', 'youtube:player_client=web_embedded,mweb,tv',
    '--downloader', 'aria2c',
    '--downloader-args', 'aria2c:-x 16 -s 16 -k 1M',
    '--merge-output-format', ext,
    '-o', tempFile,
  ];

  if (mode === 'clip' && startTime !== undefined) {
    const start = Math.max(0, startTime);
    const end = Math.max(start + 0.1, endTime ?? start + 0.1);
    downloadArgs.push('--download-sections', `*${start}-${end}`);
  }

  downloadArgs.push(sourceUrl);

  logger.info('Starting yt-dlp download', { args: downloadArgs });

  const child = spawn(env.ytDlpPath, downloadArgs);
  let clientDisconnected = false;

  child.stderr.on('data', (data: Buffer) => {
    logger.warn('yt-dlp stderr', { data: data.toString().trim() });
  });

  res.on('close', () => {
    clientDisconnected = true;
    if (!child.killed) {
      logger.info('Client disconnected, killing yt-dlp');
      child.kill('SIGKILL');
    }
    cleanupTempFiles(tempFile);
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('close', (code) => resolve(code));
    child.on('error', (err) => {
      logger.error('yt-dlp spawn error', { err: String(err) });
      resolve(1);
    });
  });

  if (clientDisconnected) return;

  if (exitCode !== 0) {
    logger.error('yt-dlp failed', { exitCode });
    res.end();
    cleanupTempFiles(tempFile);
    return;
  }

  // Find the actual output file (yt-dlp may change extension during merge)
  const actualFile = findOutputFile(tempFile, tempId, env.downloadStagingDir);

  if (!actualFile) {
    logger.error('Downloaded file not found', { tempFile });
    res.end();
    return;
  }

  logger.info('Download complete, streaming to client', { actualFile, size: fs.statSync(actualFile).size });

  const readStream = fs.createReadStream(actualFile);
  readStream.pipe(res);

  readStream.on('end', () => {
    logger.info('File streamed to client successfully');
    try { fs.unlinkSync(actualFile); } catch { /* ignore */ }
  });

  readStream.on('error', (err) => {
    logger.error('Error streaming file', { err: String(err) });
    if (!res.writableEnded) res.end();
    try { fs.unlinkSync(actualFile); } catch { /* ignore */ }
  });
}

function findOutputFile(expectedPath: string, tempId: string, stagingDir: string): string | null {
  if (fs.existsSync(expectedPath)) return expectedPath;
  try {
    const files = fs.readdirSync(stagingDir);
    for (const f of files) {
      if (f.startsWith(tempId) && !f.endsWith('.part')) {
        return path.join(stagingDir, f);
      }
    }
  } catch { /* ignore */ }
  return null;
}

function cleanupTempFiles(tempFile: string) {
  try {
    const dir = path.dirname(tempFile);
    const base = path.basename(tempFile).split('.')[0];
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith(base)) {
        try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}
