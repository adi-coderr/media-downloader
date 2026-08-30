import { spawn, execFile } from 'child_process';
import { Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

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
  let formatSelector = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/bestvideo+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
  if (kind === 'audio') {
    formatSelector = formatId ? `${formatId}` : 'bestaudio[ext=m4a]/bestaudio/best';
  } else if (formatId) {
    formatSelector = `${formatId}+bestaudio/${formatId}`;
  }

  logger.info('Backend received formatId', { formatId, kind, formatSelector });

  try {
    const ytDlpArgs = ['-j', '-f', formatSelector, '--no-warnings', '--ffmpeg-location', env.ffmpegPath, '--extractor-args', 'youtube:player_client=web_embedded,mweb,tv', sourceUrl];
    logger.info('yt-dlp arguments', { args: ytDlpArgs });

    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(
        env.ytDlpPath,
        ytDlpArgs,
        { maxBuffer: 1024 * 1024 * 32 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
          } else {
            resolve({ stdout, stderr });
          }
        }
      );
    });

    const info = JSON.parse(stdout);
    
    const outputExt = info.ext || (kind === 'audio' ? 'm4a' : 'mp4');
    const finalExtension = `.${outputExt}`;
    const correctedFilename = filename.replace(/\.[^/.]+$/, '') + finalExtension;

    // res.download will automatically set Content-Disposition and Content-Type

    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(env.downloadStagingDir)) {
      fs.mkdirSync(env.downloadStagingDir, { recursive: true });
    }

    const tempId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempFile = path.join(env.downloadStagingDir, `${tempId}${finalExtension}`);

    const downloadArgs = ['-f', formatSelector, '--no-warnings', '--ffmpeg-location', env.ffmpegPath, '--extractor-args', 'youtube:player_client=web_embedded,mweb,tv', '-o', tempFile];

    if (mode === 'clip' && startTime !== undefined) {
      const start = Math.max(0, startTime);
      const end = Math.max(start + 0.1, endTime ?? start + 0.1);
      downloadArgs.push('--download-sections', `*${start}-${end}`);
    }

    downloadArgs.push(sourceUrl);

    logger.info('Starting yt-dlp download', { args: downloadArgs });

    const child = spawn(env.ytDlpPath, downloadArgs);

    const stderrLog = fs.createWriteStream('/tmp/yt-dlp-stderr.log', { flags: 'a' });
    child.stderr.on('data', (data) => {
      stderrLog.write(data);
      logger.warn('yt-dlp stderr', { data: data.toString().trim() });
    });
    child.stderr.on('end', () => stderrLog.end());

    res.on('close', () => {
      if (!child.killed) {
        logger.info('Client disconnected, killing yt-dlp');
        child.kill('SIGKILL');
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code !== 0 && !res.writableEnded) {
          reject(new Error(`yt-dlp exited with code ${code}`));
        } else {
          resolve();
        }
      });
      child.on('error', (err) => {
        reject(err);
      });
    });

    // Send the downloaded file to the client
    if (!res.headersSent) {
      res.download(tempFile, correctedFilename, (err) => {
        if (err) logger.error('Error sending file', { err });
        if (fs.existsSync(tempFile)) {
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            // ignore
          }
        }
      });
    } else {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  } catch (err) {
    logger.error('Stream error', { err: String(err) });
    if (!res.headersSent) {
      res.status(500).send(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    } else {
      res.end();
    }
  }
}
