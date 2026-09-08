import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError';

const urlSchema = z
  .string()
  .trim()
  .min(1, 'A URL is required.')
  .transform((val) => {
    if (!/^https?:\/\//i.test(val)) {
      return `https://${val}`;
    }
    return val;
  })
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Please enter a valid http:// or https:// URL.');

const analyzeBodySchema = z.object({
  url: urlSchema,
});

export function validateAnalyzeRequest(req: Request, _res: Response, next: NextFunction): void {
  const parsed = analyzeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    next(new AppError(firstIssue?.message ?? 'Invalid request.', 422));
    return;
  }
  req.body = parsed.data;
  next();
}

const downloadBodySchema = z.object({
  sourceUrl: urlSchema,
  streamUrl: urlSchema,
  filename: z.string().trim().min(1).max(255),
  streamType: z.enum(['video', 'audio']).optional().default('video'),
  formatId: z.string().trim().min(1).max(255).optional(),
  mode: z.enum(['download', 'clip']).optional().default('download'),
  startTime: z.number().nonnegative().optional(),
  endTime: z.number().nonnegative().optional(),
  outputResolution: z.string().trim().max(50).optional(),
});

export function validateDownloadRequest(req: Request, _res: Response, next: NextFunction): void {
  const parsed = downloadBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    next(new AppError(firstIssue?.message ?? 'Invalid request.', 422));
    return;
  }
  req.body = parsed.data;
  next();
}
