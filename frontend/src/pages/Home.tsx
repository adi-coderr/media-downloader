import { useNavigate } from 'react-router-dom';
import { Hero } from '@/components/Hero';
import { useMediaAnalyze } from '@/hooks/useMediaAnalyze';
import { useEffect } from 'react';
import { useResultStore } from '@/hooks/useResultStore';
import { ResultSkeleton } from '@/components/ResultSkeleton';

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const { analyze, isLoading, media, availability, errorMessage } = useMediaAnalyze();
  const { setResult } = useResultStore();

  useEffect(() => {
    if (availability === null) {
      return;
    }

    setResult({ media, availability, errorMessage });
    navigate('/result', { state: { media, availability, errorMessage } });
  }, [availability, media, errorMessage, navigate, setResult]);

  return (
    <div>
      <Hero onAnalyze={analyze} isLoading={isLoading} />

      {isLoading && <ResultSkeleton />}

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 pb-24 sm:grid-cols-3">
        <FeatureCard
          title="Source-exposed streams only"
          description="We only ever surface the video and audio formats a site's own public player already exposes."
        />
        <FeatureCard
          title="DRM & auth respected"
          description="Protected, encrypted, or authentication-gated media is clearly flagged as not downloadable."
        />
        <FeatureCard
          title="Full download control"
          description="Track progress, speed, and time remaining — with pause, resume, and cancel at any time."
        />
      </section>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="glass-panel p-6 transition-transform duration-300 hover:-translate-y-1">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/50">{description}</p>
    </div>
  );
}
