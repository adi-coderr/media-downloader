import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { HomePage } from '@/pages/Home';
import { ResultPage } from '@/pages/Result';
import { SettingsPage } from '@/pages/Settings';
import { ClipPage } from '@/pages/Clip';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { ToastProvider } from '@/context/ToastContext';
import { ResultProvider } from '@/hooks/useResultStore';

function AnimatedRoutes(): JSX.Element {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/clip" element={<ClipPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AppShell(): JSX.Element {
  const { settings } = useSettings();

  useEffect(() => {
    const resolvedTheme = settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme;

    document.documentElement.classList.toggle('theme-light', resolvedTheme === 'light');
    document.documentElement.classList.toggle('theme-dark', resolvedTheme === 'dark');
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [settings.theme]);

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Navbar />
      <main className="pb-16">
        <AnimatedRoutes />
      </main>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ResultProvider>
          <AppShell />
        </ResultProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
