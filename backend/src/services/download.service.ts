import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Response } from 'express';
import { nanoid } from 'nanoid';
import { env } from '../config/env';
import { DownloadJob } from '../types/media.types';
import { logger } from '../utils/logger';

type Job = DownloadJob & { ytDlp?: ChildProcessWithoutNullStreams; ffmpeg?: ChildProcessWithoutNullStreams };
const jobs = new Map<string, Job>();

export function createDownloadJob(
  res: Response,
  sourceUrl: string,
  filename: string,
  kind: 'video' | 'audio',
  mode: 'download' | 'clip',
  formatId?: string,
  startTime?: number,
  endTime?: number,
  outputResolution?: string,
): DownloadJob {
  const now = Date.now();
  const job: Job = {
    id: nanoid(12), sourceStreamUrl: sourceUrl, suggestedFilename: filename, status: 'queued',
    totalBytes: null, downloadedBytes: 0, speedBytesPerSec: 0, startedAt: now, updatedAt: now,
    mode, startTime, endTime, outputResolution,
  };
  jobs.set(job.id, job);
  res.setHeader('X-Download-Id', job.id);
  void streamMedia(res, sourceUrl, filename, kind, mode, formatId, startTime, endTime, outputResolution, job);
  return publicJob(job);
}

export function getDownloadJob(id: string): DownloadJob | undefined {
  const job = jobs.get(id);
  return job ? publicJob(job) : undefined;
}

function publicJob(job: Job): DownloadJob {
  const { ytDlp: _ytDlp, ffmpeg: _ffmpeg, ...safeJob } = job;
  return safeJob;
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
  job?: Job,
): Promise<void> {
  const extension = kind === 'audio' ? 'm4a' : 'mp4';
  const safeName = filename.replace(/\.[^/.]+$/, '') + `.${extension}`;
  const formatSelector = kind === 'audio'
    ? formatId ?? 'bestaudio[ext=m4a]/bestaudio/best'
    : formatId ? `${formatId}+bestaudio/${formatId}` : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
  const ytDlpArgs = [
    '-f', formatSelector, '--no-warnings', '--newline',
    '--progress-template', 'download:%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.speed)s',
    '--concurrent-fragments', '8', '--ffmpeg-location', env.ffmpegPath,
    '--extractor-args', 'youtube:player_client=web_embedded,mweb,tv',
    '--downloader', 'aria2c', '--downloader-args', 'aria2c:-x 16 -s 16 -k 1M',
    '-o', '-', sourceUrl,
  ];
  if (mode === 'clip' && startTime !== undefined) {
    ytDlpArgs.splice(-2, 0, '--download-sections', `*${Math.max(0, startTime)}-${Math.max(startTime + 0.1, endTime ?? startTime + 0.1)}`);
  }

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`);
  res.setHeader('Content-Type', kind === 'audio' ? 'audio/mp4' : 'video/mp4');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  const ytDlp = spawn(env.ytDlpPath, ytDlpArgs);
  const ffmpeg = spawn(env.ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-map', '0', '-c', 'copy',
    '-f', kind === 'audio' ? 'ipod' : 'mp4',
    ...(kind === 'video' ? ['-movflags', 'frag_keyframe+empty_moov'] : []), 'pipe:1',
  ]);
  if (job) {
    job.status = 'downloading'; job.updatedAt = Date.now(); job.ytDlp = ytDlp; job.ffmpeg = ffmpeg;
  }

  let progressBuffer = '';
  ytDlp.stderr.on('data', (data: Buffer) => {
    const text = data.toString();
    progressBuffer += text;
    const lines = progressBuffer.split(/\r?\n/);
    progressBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const match = line.match(/^download:(\d+)\|([^|]+)\|([^|]+)$/);
      if (!match || !job) continue;
      const downloaded = Number(match[1]);
      const total = Number(match[2]);
      const speed = Number(match[3]);
      if (Number.isFinite(downloaded)) job.downloadedBytes = downloaded;
      if (Number.isFinite(total) && total > 0) job.totalBytes = total;
      if (Number.isFinite(speed) && speed > 0) job.speedBytesPerSec = speed;
      job.updatedAt = Date.now();
    }
    logger.debug('yt-dlp output', { jobId: job?.id, output: text.trim() });
  });
  ytDlp.stderr.on('error', (error) => logger.error('yt-dlp stderr error', { error: String(error), jobId: job?.id }));
  ffmpeg.stderr.on('data', (data: Buffer) => logger.warn('ffmpeg stderr', { data: data.toString().trim(), jobId: job?.id }));
  ytDlp.stdout.pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(res);

  let finished = false;
  const terminate = (): void => {
    if (!ytDlp.killed) ytDlp.kill('SIGKILL');
    if (!ffmpeg.killed) ffmpeg.kill('SIGKILL');
  };
  const fail = (message: string): void => {
    if (finished) return;
    finished = true; terminate();
    if (job) { job.status = 'error'; job.error = message; job.updatedAt = Date.now(); }
    if (!res.writableEnded) res.destroy(new Error(message));
  };
  res.on('close', () => {
    if (!finished) terminate();
  });
  ytDlp.on('error', () => fail('yt-dlp could not start or stopped unexpectedly.'));
  ffmpeg.on('error', () => fail('FFmpeg could not start or stopped unexpectedly.'));
  ytDlp.on('close', (code) => {
    if (code !== 0 && !finished) fail(`yt-dlp exited with code ${code ?? 'unknown'}.`);
  });
  ffmpeg.on('close', (code) => {
    if (finished) return;
    finished = true;
    if (code !== 0) {
      if (job) { job.status = 'error'; job.error = `FFmpeg exited with code ${code ?? 'unknown'}.`; job.updatedAt = Date.now(); }
      if (!res.writableEnded) res.destroy(new Error('FFmpeg failed while processing the media.'));
      return;
    }
    if (job) {
      job.status = 'completed'; job.updatedAt = Date.now();
      if (job.totalBytes === null) job.totalBytes = job.downloadedBytes;
    }
    if (!res.writableEnded) res.end();
  });
}
