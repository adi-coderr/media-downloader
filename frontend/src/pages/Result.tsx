import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AudioLines, Film } from 'lucide-react';
import { useResultStore } from '@/hooks/useResultStore';
import { useDownloads } from '@/context/DownloadContext';
import { useToast } from '@/context/ToastContext';
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
  const { showToast } = useToast();
  const { enqueue } = useDownloads();

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
    await enqueue({ sourceUrl: media.sourceUrl, filename, streamType: 'video', formatId: stream.formatId });
    showToast('Download queued', 'You can track its real progress above.', 'success');
  };

  const handleAudioDownload = async (stream: AudioStream): Promise<void> => {
    if (!media) return;
    const filename = buildFilename(media.title, stream.container, stream.format);
    await enqueue({ sourceUrl: media.sourceUrl, filename, streamType: 'audio', formatId: stream.formatId });
    showToast('Download queued', 'You can track its real progress above.', 'success');
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
            <div className="mb-4 flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-white">Video streams</h2>
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/40">
                {media.videoStreams.length}
              </span>
            </div>

            {media.videoStreams.length === 0 ? (
              <EmptyState
                icon={Film}
                title="No video streams available"
                description="This source did not expose any downloadable video formats."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {media.videoStreams.map((stream, index) => (
                  <StreamCard
                    key={stream.formatId}
                    stream={stream}
                    media={media}
                    index={index}
                    onDownload={handleVideoDownload}
                    isQueued={false}
                  />
                ))}
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
                    isQueued={false}
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
