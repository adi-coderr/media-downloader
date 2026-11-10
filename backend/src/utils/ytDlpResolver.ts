import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { logger } from './logger';

export function isExecutableWorking(binPath: string): boolean {
  try {
    const output = execFileSync(binPath, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return Boolean(output && output.trim().length > 0);
  } catch {
    return false;
  }
}

export function getPlatformBinaryInfo(): { url: string; filename: string } {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    return {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
      filename: 'yt-dlp.exe',
    };
  }

  if (platform === 'darwin') {
    return {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
      filename: 'yt-dlp',
    };
  }

  if (platform === 'linux') {
    if (arch === 'arm64' || (arch as string) === 'aarch64') {
      return {
        url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64',
        filename: 'yt-dlp',
      };
    }
    return {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
      filename: 'yt-dlp',
    };
  }

  return {
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    filename: 'yt-dlp',
  };
}

export async function ensureYtDlp(configuredPath?: string): Promise<string> {
  // 1. Explicitly configured path from environment
  if (configuredPath && isExecutableWorking(configuredPath)) {
    logger.info('Using configured yt-dlp path', { ytDlpPath: configuredPath });
    return configuredPath;
  }

  // 2. System PATH check
  const systemCandidates = process.platform === 'win32' ? ['yt-dlp.exe', 'yt-dlp'] : ['yt-dlp'];
  for (const cmd of systemCandidates) {
    if (isExecutableWorking(cmd)) {
      logger.info('Found system yt-dlp in PATH', { ytDlpPath: cmd });
      return cmd;
    }
  }

  // 3. Check local bin directory inside backend
  const { url, filename } = getPlatformBinaryInfo();
  const binDir = path.resolve(__dirname, '../../bin');
  const targetBinPath = path.join(binDir, filename);

  if (fs.existsSync(targetBinPath) && isExecutableWorking(targetBinPath)) {
    logger.info('Using local cached yt-dlp binary', { ytDlpPath: targetBinPath });
    return targetBinPath;
  }

  // 4. Auto-download the release binary for the current OS/architecture
  logger.info(`yt-dlp not found on system. Auto-downloading latest release for ${process.platform} (${process.arch})...`, {
    downloadUrl: url,
    targetPath: targetBinPath,
  });

  try {
    fs.mkdirSync(binDir, { recursive: true });
    const tempPath = `${targetBinPath}.tmp-${Date.now()}`;

    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download yt-dlp (HTTP ${res.status} ${res.statusText})`);
    }

    const fileStream = fs.createWriteStream(tempPath, { mode: 0o755 });
    // @ts-ignore
    await pipeline(Readable.fromWeb(res.body as any), fileStream);

    if (process.platform !== 'win32') {
      fs.chmodSync(tempPath, 0o755);
    }

    fs.renameSync(tempPath, targetBinPath);

    if (!isExecutableWorking(targetBinPath)) {
      throw new Error('Downloaded binary failed sanity check (--version)');
    }

    logger.info('yt-dlp downloaded and verified successfully', { ytDlpPath: targetBinPath });
    return targetBinPath;
  } catch (error) {
    logger.error('Failed to auto-download yt-dlp binary. Please install yt-dlp manually: https://github.com/yt-dlp/yt-dlp#installation', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
