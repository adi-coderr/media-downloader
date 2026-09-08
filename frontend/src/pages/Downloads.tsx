import { AnimatePresence, motion } from 'framer-motion';
import { DownloadCloud } from 'lucide-react';
import { useDownloads } from '@/context/DownloadContext';
import { DownloadItem } from '@/components/DownloadItem';
import { EmptyState } from '@/components/EmptyState';

export function DownloadsPage(): JSX.Element {
  const { jobs, pause, resume, cancel } = useDownloads();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-3xl font-bold text-white"
      >
        Downloads
      </motion.h1>

      {jobs.length === 0 ? (
        <EmptyState
          icon={DownloadCloud}
          title="No downloads yet"
          description="Analyze a media URL from the home page and start a download to see it appear here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {jobs.map((job) => (
              <DownloadItem key={job.id} job={job} onPause={pause} onResume={resume} onCancel={cancel} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
