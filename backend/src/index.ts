import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './utils/logger';
import { ensureYtDlp, isExecutableWorking } from './utils/ytDlpResolver';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import mediaRoutes from './routes/media.routes';
import downloadRoutes from './routes/download.routes';

const app: Express = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-session-id'],
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

async function bootstrap(): Promise<void> {
  try {
    env.ytDlpPath = await ensureYtDlp(process.env.YTDLP_PATH);
    logger.info('yt-dlp initialized successfully', { ytDlpPath: env.ytDlpPath });
  } catch (err) {
    logger.error('Failed to initialize yt-dlp', { error: err });
  }

  if (isExecutableWorking(env.ffmpegPath)) {
    logger.info('ffmpeg availability check: ready', { ffmpegPath: env.ffmpegPath });
  } else {
    logger.warn('ffmpeg not found or not working. Some merging features may be degraded.', {
      ffmpegPath: env.ffmpegPath,
    });
  }

  app.listen(env.port, () => {
    logger.info(`Media Downloader API listening on port ${env.port} [${env.nodeEnv}]`);
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal error during startup', { error: err });
  process.exit(1);
});
