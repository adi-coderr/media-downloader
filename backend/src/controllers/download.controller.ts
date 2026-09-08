import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import {
  cancelDownloadJob,
  createDownloadJob,
  getDownloadFilePath,
  getDownloadJob,
  listDownloadJobs,
  pauseDownloadJob,
  resumeDownloadJob,
} from '../services/download.service';

export const startDownload = asyncHandler(async (req: Request, res: Response) => {
  const { sourceUrl, streamUrl, filename, streamType, formatId, mode, startTime, endTime, outputResolution } = req.body as {
    sourceUrl: string;
    streamUrl: string;
    filename: string;
    streamType?: 'video' | 'audio';
    formatId?: string;
    mode?: 'download' | 'clip';
    startTime?: number;
    endTime?: number;
    outputResolution?: string;
  };
  try {
    const job = createDownloadJob(
      sourceUrl,
      streamUrl,
      filename,
      streamType ?? 'video',
      formatId,
      mode ?? 'download',
      startTime,
      endTime,
      outputResolution,
    );
    res.status(201).json({ success: true, job });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to start download.';
    // Log and return a helpful error to the client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { logger } = require('../utils/logger');
    logger.error('Failed to create download job', { message, payload: req.body });
    throw new AppError(message, 400);
  }
});

export const getDownload = asyncHandler(async (req: Request, res: Response) => {
  const job = getDownloadJob(req.params.id);
  if (!job) {
    throw new AppError('Download job not found.', 404);
  }
  res.status(200).json({ success: true, job });
});

export const getAllDownloads = asyncHandler(async (_req: Request, res: Response) => {
  const jobs = listDownloadJobs();
  res.status(200).json({ success: true, jobs });
});

export const pauseDownload = asyncHandler(async (req: Request, res: Response) => {
  const job = pauseDownloadJob(req.params.id);
  res.status(200).json({ success: true, job });
});

export const resumeDownload = asyncHandler(async (req: Request, res: Response) => {
  const job = resumeDownloadJob(req.params.id);
  res.status(200).json({ success: true, job });
});

export const cancelDownload = asyncHandler(async (req: Request, res: Response) => {
  const job = cancelDownloadJob(req.params.id);
  res.status(200).json({ success: true, job });
});

export const fetchDownloadFile = asyncHandler(async (req: Request, res: Response) => {
  const { filePath, filename } = getDownloadFilePath(req.params.id);
  res.download(filePath, filename);
});
