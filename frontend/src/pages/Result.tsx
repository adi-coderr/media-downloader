import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AudioLines, Film, Filter } from 'lucide-react';
import { useResultStore } from '@/hooks/useResultStore';
import { useDownloads } from '@/context/DownloadContext';
import { useToast } from '@/context/ToastContext';
import { useSettings } from '@/context/SettingsContext';
import { MediaSummaryCard } from '@/components/MediaSummaryCard';
import { StreamCard } from '@/components/StreamCard';
import { AudioCard } from '@/components/AudioCard';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { VideoStream, AudioStream } from '@/types/media';

function buildFilename(title: string, extension: string | null, resolutionLabel: string | null): string {
  const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'media';
  const suffix = resolutionLabel ? `-${resolutionLabel}` : '';
  const ext = extension ?? 'mp4';
  return `${safeTitle}${suffix}.${ext}`;
}

export function ResultPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { result, setResult, clearResult } = useResultStore();
  const { media, availability, errorMessage } = result;
  const { jobs, startNewDownload } = useDownloads();
  const { showToast } = useToast();
  const { settings } = useSettings();

  const [activeFormat, setActiveFormat] = useState<string>(settings.preferredFormat);

  useEffect(() => {
    setActiveFormat(settings.preferredFormat);
  }, [settings.preferredFormat]);

  const availableContainers = useMemo(() => {
    if (!media) return [];
    const counts = new Map<string, number>();
    for (const stream of media.videoStreams) {
      const ext = (stream.container ?? 'other').toLowerCase();
      counts.set(ext, (counts.get(ext) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([ext, count]) => ({
      ext,
      label: ext.toUpperCase(),
      count,
    }));
  }, [media]);

  const filteredVideoStreams = useMemo(() => {
    if (!media) return [];
    if (activeFormat === 'original') {
      return media.videoStreams;
    }
    return media.videoStreams.filter(
      (stream) => (stream.container ?? '').toLowerCase() === activeFormat.toLowerCase(),
    );
  }, [media, activeFormat]);

  useEffect(() => {
    if (availability !== null) {
      return;
    }

    const state = location.state as { media?: typeof media; availability?: typeof availability; errorMessage?: typeof errorMessage } | null;
    if (state?.availability !== undefined) {
      setResult({ media: state.media ?? null, availability: state.availability, errorMessage: state.errorMessage ?? null });
      return;
    }

    navigate('/', { replace: true });
  }, [availability, location.state, navigate, setResult]);

  const handleVideoDownload = async (stream: VideoStream): Promise<void> => {
    if (!media) return;
    const filename = buildFilename(media.title, stream.container, stream.resolution);
    try {
      await startNewDownload(media.sourceUrl, stream.directUrl, filename, 'video', stream.formatId);
      showToast('Download started', 'Check the Downloads page for live progress.', 'success');
      navigate('/downloads');
    } catch (error) {
      showToast('Download failed', error instanceof Error ? error.message : 'Unable to start download.', 'error');
    }
  };

  const handleAudioDownload = async (stream: AudioStream): Promise<void> => {
    if (!media) return;
    const filename = buildFilename(media.title, stream.container, stream.format);
    try {
      await startNewDownload(media.sourceUrl, stream.directUrl, filename, 'audio', stream.formatId);
      showToast('Download started', 'Check the Downloads page for live progress.', 'success');
      navigate('/downloads');
    } catch (error) {
      showToast('Download failed', error instanceof Error ? error.message : 'Unable to start download.', 'error');
    }
  };

  if (availability === null) {
    return <></>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <button
        type="button"
        onClick={() => {
          clearResult();
          navigate('/');
        }}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Analyze another URL
      </button>

      {availability !== 'available' && (
        <ErrorState availability={availability} message={errorMessage ?? 'Something went wrong.'} />
      )}

      {availability === 'available' && media && (
        <>
          <MediaSummaryCard media={media} />

          <div className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-white">Video streams</h2>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/40">
                  {filteredVideoStreams.length} of {media.videoStreams.length}
                </span>
              </div>

              {availableContainers.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1 text-xs">
                  <div className="flex items-center gap-1 px-2 text-white/40">
                    <Filter className="h-3 w-3" />
                    <span>Format:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveFormat('original')}
                    className={`rounded-xl px-2.5 py-1 font-medium transition ${
                      activeFormat === 'original'
                        ? 'bg-primary text-slate-950 font-semibold shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    All ({media.videoStreams.length})
                  </button>
                  {availableContainers.map(({ ext, label, count }) => (
                    <button
                      key={ext}
                      type="button"
                      onClick={() => setActiveFormat(ext)}
                      className={`rounded-xl px-2.5 py-1 font-medium transition ${
                        activeFormat.toLowerCase() === ext
                          ? 'bg-primary text-slate-950 font-semibold shadow-sm'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {media.videoStreams.length === 0 ? (
              <EmptyState
                icon={Film}
                title="No video streams available"
                description="This source did not expose any downloadable video formats."
              />
            ) : filteredVideoStreams.length === 0 ? (
              <div className="glass-panel flex flex-col items-center justify-center p-8 text-center">
                <Film className="mb-3 h-10 w-10 text-white/20" />
                <h3 className="text-base font-semibold text-white">
                  No {activeFormat.toUpperCase()} streams available for this video
                </h3>
                <p className="mt-1 max-w-md text-sm text-white/50">
                  This source provided {availableContainers.map((c) => `${c.count} ${c.label}`).join(', ')} streams.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveFormat('original')}
                  className="btn-primary mt-4 px-4 py-2 text-xs"
                >
                  Show all available streams ({media.videoStreams.length})
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVideoStreams.map((stream, index) => {
                  const isPreferred =
                    (stream.container ?? '').toLowerCase() === settings.preferredFormat.toLowerCase() ||
                    stream.resolution === settings.preferredQuality;
                  return (
                    <StreamCard
                      key={stream.formatId}
                      stream={stream}
                      media={media}
                      index={index}
                      onDownload={handleVideoDownload}
                      isQueued={jobs.some((job) => job.sourceStreamUrl === stream.directUrl)}
                      isPreferred={isPreferred}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {media.audioStreams.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10">
              <div className="mb-4 flex items-center gap-2">
                <AudioLines className="h-5 w-5 text-success" />
                <h2 className="text-lg font-bold text-white">Audio-only streams</h2>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/40">
                  {media.audioStreams.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {media.audioStreams.map((stream, index) => (
                  <AudioCard
                    key={stream.formatId}
                    stream={stream}
                    index={index}
                    onDownload={handleAudioDownload}
                    isQueued={jobs.some((job) => job.sourceStreamUrl === stream.directUrl)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
