import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pause, Play, Scissors, Video } from 'lucide-react';
import { getStreamUrl } from '@/api/downloadApi';
import { useToast } from '@/context/ToastContext';
import { useResultStore } from '@/hooks/useResultStore';
import { MediaMetadata, VideoStream } from '@/types/media';

interface ClipPageState {
  media: MediaMetadata;
  stream: VideoStream;
}

function buildFilename(title: string, extension: string | null, resolutionLabel: string | null): string {
  const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'media';
  const suffix = resolutionLabel ? `-${resolutionLabel}` : '';
  const ext = extension ?? 'mp4';
  return `${safeTitle}${suffix}.${ext}`;
}

export function ClipPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { result } = useResultStore();
  const { showToast } = useToast();

  const state = location.state as ClipPageState | undefined;
  const media = state?.media ?? result.media;
  const stream = state?.stream ?? null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);
  const [outputResolution, setOutputResolution] = useState('original');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (!media || !stream) {
      navigate('/result', { replace: true });
      return;
    }

    const defaultEnd = Math.max(10, media.durationSeconds ? Math.min(media.durationSeconds, 30) : 30);
    setEndTime(defaultEnd);
  }, [media, stream, navigate]);

  const clampTime = (value: number): number => {
    if (duration === null) {
      return value;
    }
    return Math.min(Math.max(value, 0), duration);
  };

  const handleSeek = (value: number): void => {
    const nextValue = clampTime(value);
    setCurrentTime(nextValue);
    if (videoRef.current) {
      videoRef.current.currentTime = nextValue;
    }
  };

  const handleSetStart = (): void => {
    const nextStart = clampTime(currentTime);
    const nextEnd = Math.max(nextStart + 0.5, endTime);
    setStartTime(nextStart);
    const clampedEnd = Math.min(duration ?? nextEnd, nextEnd);
    setEndTime(clampedEnd);
    setCurrentTime(nextStart);
  };

  const handleSetEnd = (): void => {
    const nextEnd = clampTime(currentTime);
    const nextStart = Math.min(startTime, Math.max(0, nextEnd - 0.5));
    setEndTime(nextEnd);
    setStartTime(nextStart);
    setCurrentTime(nextEnd);
  };

  const togglePlayback = (): void => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      return;
    }
    void videoRef.current.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });
  };

  const resolutionOptions = useMemo(() => {
    const options = ['original', '240p', '360p', '480p', '720p', '1080p'];
    if (stream?.height && !options.includes(`${stream.height}p`)) {
      options.splice(options.indexOf('1080p') + 1, 0, `${stream.height}p`);
    }
    return options;
  }, [stream?.height]);

  const handleSubmit = async (): Promise<void> => {
    if (!media || !stream) return;

    const safeStart = Number(startTime);
    const safeEnd = Number(endTime);

    if (!Number.isFinite(safeStart) || !Number.isFinite(safeEnd) || safeStart < 0 || safeEnd <= safeStart) {
      showToast('Invalid clip range', 'Please choose a valid start and end time.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const filename = buildFilename(media.title, stream.container, `${stream.resolution ?? 'clip'}-${safeStart}s-${safeEnd}s`);
      window.location.href = getStreamUrl(
        media.sourceUrl,
        filename,
        'video',
        'clip',
        stream.formatId,
        safeStart,
        safeEnd,
        outputResolution,
      );
      showToast('Clip queued', 'Your trimmed export will begin downloading shortly.', 'success');
      navigate('/', { replace: true });
    } catch {
      showToast('Could not start clip download', 'Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!media || !stream) {
    return <></>;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <button
        type="button"
        onClick={() => navigate('/result', { replace: true })}
        className="flex items-center gap-2 text-sm font-medium text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to results
      </button>

      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Scissors className="h-5 w-5" />
              <h1 className="text-2xl font-bold text-white">Clip and export</h1>
            </div>
            <p className="max-w-2xl text-sm text-white/60">
              Choose a segment of the selected video and export it in your preferred resolution.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            <p className="font-semibold text-white">{media.title}</p>
            <p className="mt-1">{stream.resolution ?? 'Unknown resolution'}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5 rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-white">Trim settings</p>
                <p className="text-sm text-white/50">Play the preview, scrub to the right moment, and tap the buttons to set your clip range.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              <video
                ref={videoRef}
                src={stream.directUrl}
                poster={media.thumbnailUrl ?? undefined}
                controls
                className="aspect-video w-full bg-black"
                onLoadedMetadata={(event) => {
                  const nextDuration = event.currentTarget.duration;
                  if (Number.isFinite(nextDuration) && nextDuration > 0) {
                    setDuration(nextDuration);
                    setEndTime(Math.min(Math.max(10, media.durationSeconds ? Math.min(media.durationSeconds, 30) : 30), nextDuration));
                  }
                }}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={() => setPreviewError(true)}
              />
            </div>

            {previewError && (
              <p className="text-sm text-amber-400">
                The preview could not be loaded from the source URL, but the clip range selectors below still work for your export.
              </p>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between text-sm text-white/70">
                <span>Current position</span>
                <span>{currentTime.toFixed(1)}s / {duration ? duration.toFixed(1) : '—'}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={duration ?? 100}
                step="0.01"
                value={currentTime}
                onChange={(event) => handleSeek(Number(event.target.value))}
                className="w-full accent-primary"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={togglePlayback} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10">
                  {isPlaying ? <Pause className="mr-2 inline h-4 w-4" /> : <Play className="mr-2 inline h-4 w-4" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button type="button" onClick={handleSetStart} className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20">
                  Set start from current
                </button>
                <button type="button" onClick={handleSetEnd} className="rounded-2xl border border-success/20 bg-success/10 px-3 py-2 text-sm text-success hover:bg-success/20">
                  Set end from current
                </button>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="flex flex-col gap-2 text-sm text-white/70">
                <span>Clip start</span>
                <input
                  type="range"
                  min="0"
                  max={duration ?? 100}
                  step="0.01"
                  value={startTime}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    const nextStart = clampTime(nextValue);
                    if (nextStart >= endTime) {
                      setStartTime(nextStart);
                      const newEnd = Math.min(duration ?? nextStart + 0.5, nextStart + 0.5);
                      setEndTime(newEnd);
                      setCurrentTime(nextStart);
                    } else {
                      setStartTime(nextStart);
                      setCurrentTime(nextStart);
                    }
                  }}
                  className="accent-primary"
                />
                <span className="text-xs text-white/40">{startTime.toFixed(1)}s</span>
              </label>
              <label className="flex flex-col gap-2 text-sm text-white/70">
                <span>Clip end</span>
                <input
                  type="range"
                  min="0"
                  max={duration ?? 100}
                  step="0.01"
                  value={endTime}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    const nextEnd = clampTime(nextValue);
                    if (nextEnd <= startTime) {
                      setEndTime(nextEnd);
                      setStartTime(Math.max(0, nextEnd - 0.5));
                      setCurrentTime(nextEnd);
                    } else {
                      setEndTime(nextEnd);
                      setCurrentTime(nextEnd);
                    }
                  }}
                  className="accent-primary"
                />
                <span className="text-xs text-white/40">{endTime.toFixed(1)}s</span>
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm text-white/70">
              <span>Output resolution</span>
              <select
                value={outputResolution}
                onChange={(event) => setOutputResolution(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none ring-0"
              >
                {resolutionOptions.map((option) => (
                  <option key={option} value={option} className="text-slate-900">
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">What happens next?</h2>
            <ul className="space-y-3 text-sm text-white/60">
              <li>• The selected segment will be exported as a new video file.</li>
              <li>• If you choose a resolution like 720p, the clip will be resized for that output.</li>
              <li>• The export will be added to your download queue and appear in Downloads.</li>
            </ul>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:bg-white/10"
            >
              {isSubmitting ? 'Preparing clip...' : 'Queue clip download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
