import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { inspectMedia } from '../services/mediaInspector.service';

export const analyzeMedia = asyncHandler(async (req: Request, res: Response) => {
  const { url } = req.body as { url: string };

  const result = await inspectMedia(url);

  if (result.availability === 'available' && result.media) {
    res.status(200).json({ success: true, availability: result.availability, media: result.media });
    return;
  }

  const statusCode = result.availability === 'invalid' ? 422 : 200;

  res.status(statusCode).json({
    success: false,
    availability: result.availability,
    message: result.message,
  });
});
