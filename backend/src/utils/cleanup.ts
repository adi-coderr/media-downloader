import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import { logger } from './logger';

export function startCleanupTask() {
  const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  const MAX_AGE = 10 * 60 * 1000; // 10 minutes

  setInterval(() => {
    logger.info('Running periodic cleanup of old downloaded files...');
    try {
      if (fs.existsSync(env.downloadStagingDir)) {
        const files = fs.readdirSync(env.downloadStagingDir);
        const now = Date.now();
        for (const file of files) {
          try {
            const filePath = path.join(env.downloadStagingDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > MAX_AGE) {
              fs.unlinkSync(filePath);
              logger.info(`Deleted old file: ${file}`);
            }
          } catch (err) {
            logger.error(`Failed to delete file ${file}`, { err: String(err) });
          }
        }
      }
    } catch (err) {
      logger.error('Error during cleanup task', { err: String(err) });
    }
  }, CLEANUP_INTERVAL);
}
