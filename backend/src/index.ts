import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './utils/logger';
import { execFileSync } from 'child_process';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import mediaRoutes from './routes/media.routes';
import downloadRoutes from './routes/download.routes';
import { startCleanupTask } from './utils/cleanup';

const app: Express = express();
startCleanupTask();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'frame-ancestors': ["'self'", env.corsOrigin],
    },
  },
}));
app.use(
  cors({
    origin: env.corsOrigin,
    methods: ['GET', 'POST'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(
  morgan(env.isProduction ? 'combined' : 'dev', {
    stream: { write: (message: string) => logger.info(message.trim()) },
  }),
);

const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
});
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/media', mediaRoutes);
app.use('/api/downloads', downloadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  logger.info(`Media Downloader API listening on port ${env.port} [${env.nodeEnv}]`);
  // Verify required CLI tools are available and log helpful instructions
  try {
    const ytDlpPath = execFileSync('which', [env.ytDlpPath]).toString().trim() || env.ytDlpPath;
    logger.info('yt-dlp availability check', { ytDlpPath });
  } catch (err) {
    logger.warn('yt-dlp not found in PATH. Ensure yt-dlp is installed and reachable.', { ytDlpPath: env.ytDlpPath });
  }

  try {
    const ffmpegPath = execFileSync('which', [env.ffmpegPath]).toString().trim() || env.ffmpegPath;
    logger.info('ffmpeg availability check', { ffmpegPath });
  } catch (err) {
    logger.warn('ffmpeg not found in PATH. Ensure ffmpeg is installed and reachable.', { ffmpegPath: env.ffmpegPath });
  }
});
