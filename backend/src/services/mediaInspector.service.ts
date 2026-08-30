import { execFile } from 'child_process';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  AudioStream,
  InspectResult,
  MediaMetadata,
  VideoStream,
} from '../types/media.types';

/**
 * This service shells out to yt-dlp, a widely used open-source media metadata
 * extractor. yt-dlp only ever reports the formats that the source site's own
 * public player/API already exposes. It does NOT decrypt DRM-protected streams
 * (Widevine/PlayReady/FairPlay), does NOT bypass authentication or paywalls,
 * and does NOT circumvent access controls. When a site protects its content,
 * yt-dlp fails to extract playable formats and we surface that as
 * "protected" to the user rather than attempting any workaround.
 */

interface YtDlpFormat {
  format_id: string;
  ext?: string;
  resolution?: string;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  vcodec?: string;
  acodec?: string;
  filesize?: number | null;
  filesize_approx?: number | null;
  tbr?: number | null;
  abr?: number | null;
  vbr?: number | null;
  protocol?: string;
  url?: string;
  format_note?: string;
  has_drm?: boolean;
}

interface YtDlpInfo {
  title?: string;
  thumbnail?: string;
  duration?: number | null;
  uploader?: string | null;
  extractor?: string;
  is_live?: boolean;
  formats?: YtDlpFormat[];
  webpage_url?: string;
  _type?: string;
}

const DRM_ERROR_PATTERNS = [
  /drm/i,
  /widevine/i,
  /playready/i,
  /fairplay/i,
  /license/i,
  /this video is protected/i,
];

const NOT_FOUND_ERROR_PATTERNS = [
  /unsupported url/i,
  /unable to extract/i,
  /404/i,
  /video unavailable/i,
  /content is not available/i,
  /no video formats found/i,
];

const AUTH_ERROR_PATTERNS = [
  /private video/i,
  /sign in/i,
  /login required/i,
  /members-only/i,
  /subscription/i,
  /geo.?restrict/i,
  /rental/i,
  /premium/i,
];

function runYtDlp(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      env.ytDlpPath,
      args,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 32 },
      (error, stdout, stderr) => {
        if (error) {
          const combined = `${stderr}\n${stdout}`;
          reject(new Error(combined || error.message));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

function classifyFailure(errorMessage: string): 'protected' | 'not_found' | 'invalid' {
  if (DRM_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'protected';
  }
  if (AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'protected';
  }
  if (NOT_FOUND_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'not_found';
  }
  return 'invalid';
}

function buildResolutionLabel(format: YtDlpFormat): string | null {
  if (format.height) {
    return `${format.height}p`;
  }
  if (format.resolution && format.resolution !== 'audio only') {
    return format.resolution;
  }
  return null;
}

function toVideoStream(format: YtDlpFormat): VideoStream | null {
  const hasVideo = format.vcodec && format.vcodec !== 'none';
  if (!hasVideo || !format.url) {
    return null;
  }

  const hasAudio = Boolean(format.acodec && format.acodec !== 'none');
  const estimatedSizeBytes = format.filesize ?? format.filesize_approx ?? null;

  return {
    formatId: format.format_id,
    resolution: buildResolutionLabel(format),
    width: format.width ?? null,
    height: format.height ?? null,
    fps: format.fps ?? null,
    videoCodec: format.vcodec ?? null,
    audioCodec: hasAudio ? format.acodec ?? null : null,
    container: format.ext ?? null,
    hasAudio,
    estimatedSizeBytes,
    bitrateKbps: format.tbr ?? format.vbr ?? null,
    directUrl: format.url,
    protocol: format.protocol ?? 'https',
  };
}

function toAudioStream(format: YtDlpFormat): AudioStream | null {
  const hasVideo = format.vcodec && format.vcodec !== 'none';
  const hasAudio = format.acodec && format.acodec !== 'none';
  if (hasVideo || !hasAudio || !format.url) {
    return null;
  }

  const estimatedSizeBytes = format.filesize ?? format.filesize_approx ?? null;

  return {
    formatId: format.format_id,
    format: format.format_note ?? format.ext ?? 'audio',
    audioCodec: format.acodec ?? null,
    bitrateKbps: format.abr ?? format.tbr ?? null,
    container: format.ext ?? null,
    estimatedSizeBytes,
    directUrl: format.url,
    protocol: format.protocol ?? 'https',
  };
}

function mapInfoToMedia(info: YtDlpInfo, sourceUrl: string): MediaMetadata {
  const formats = info.formats ?? [];

  const videoStreams = formats
    .map(toVideoStream)
    .filter((stream): stream is VideoStream => stream !== null)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

  const audioStreams = formats
    .map(toAudioStream)
    .filter((stream): stream is AudioStream => stream !== null)
    .sort((a, b) => (b.bitrateKbps ?? 0) - (a.bitrateKbps ?? 0));

  return {
    sourceUrl: info.webpage_url ?? sourceUrl,
    title: info.title ?? 'Untitled media',
    thumbnailUrl: info.thumbnail ?? null,
    durationSeconds: info.duration ?? null,
    uploader: info.uploader ?? null,
    extractor: info.extractor ?? 'generic',
    isLive: Boolean(info.is_live),
    videoStreams,
    audioStreams,
  };
}

export async function inspectMedia(sourceUrl: string): Promise<InspectResult> {
  try {
    const { stdout } = await runYtDlp(
      [
        '--dump-single-json',
        '--no-warnings',
        '--no-playlist',
        '--socket-timeout', '15',
        sourceUrl,
      ],
      env.inspectTimeoutMs,
    );

    const info = JSON.parse(stdout) as YtDlpInfo;

    const formats = info.formats ?? [];
    const hasDrmFormat = formats.some((format) => format.has_drm);
    if (hasDrmFormat && formats.every((format) => format.has_drm || !format.url)) {
      return {
        availability: 'protected',
        message: 'This media is protected and cannot be downloaded.',
      };
    }

    const media = mapInfoToMedia(info, sourceUrl);

    if (media.isLive) {
      return {
        availability: 'protected',
        message: 'Live streams cannot be downloaded through this tool.',
      };
    }

    if (media.videoStreams.length === 0 && media.audioStreams.length === 0) {
      return {
        availability: 'not_found',
        message: 'No downloadable media was found.',
      };
    }

    return { availability: 'available', media };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Media inspection failed', { sourceUrl, message: message.slice(0, 500) });

    const classification = classifyFailure(message);

    if (classification === 'protected') {
      return {
        availability: 'protected',
        message: 'This media is protected and cannot be downloaded.',
      };
    }

    if (classification === 'not_found') {
      return {
        availability: 'not_found',
        message: 'No downloadable media was found.',
      };
    }

    return {
      availability: 'invalid',
      message: 'Please enter a valid, publicly accessible media URL.',
    };
  }
}
