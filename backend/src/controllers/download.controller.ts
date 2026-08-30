import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { streamMedia } from '../services/download.service';

export const streamDownload = asyncHandler(async (req: Request, res: Response) => {
  const { sourceUrl, filename, streamType, mode, formatId, startTime, endTime, outputResolution } = req.query as {
    sourceUrl: string;
    filename: string;
    streamType?: 'video' | 'audio';
    mode?: 'download' | 'clip';
    formatId?: string;
    startTime?: string;
    endTime?: string;
    outputResolution?: string;
  };

  try {
    await streamMedia(
      res,
      sourceUrl,
      filename,
      streamType ?? 'video',
      mode ?? 'download',
      formatId,
      startTime ? Number(startTime) : undefined,
      endTime ? Number(endTime) : undefined,
      outputResolution,
    );
  } catch (err) {
    // If headers are not sent, we can still send a JSON error or text error
    if (!res.headersSent) {
      const message = err instanceof Error ? err.message : 'Unable to start download.';
      res.status(500).send(`Download failed: ${message}`);
    }
  }
});
