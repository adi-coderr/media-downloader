import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

export function requireSession(req: Request, _res: Response, next: NextFunction): void {
  const headerSession = req.headers['x-session-id'];
  const querySession = req.query.sessionId;

  const rawSession =
    typeof headerSession === 'string' && headerSession.trim().length > 0
      ? headerSession.trim()
      : typeof querySession === 'string' && querySession.trim().length > 0
      ? querySession.trim()
      : null;

  if (!rawSession) {
    next(new AppError('A valid session ID is required to manage downloads.', 401));
    return;
  }

  // Validate session format: alphanumeric, dashes, underscores, length 8..128
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(rawSession)) {
    next(new AppError('Invalid session identifier format.', 400));
    return;
  }

  req.sessionId = rawSession;
  next();
}

