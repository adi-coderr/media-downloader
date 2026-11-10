import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Home, Settings as SettingsIcon } from 'lucide-react';
import { useRef } from 'react';
import { useResultStore } from '@/hooks/useResultStore';
import { useToast } from '@/context/ToastContext';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/downloads', label: 'Downloads', icon: Download },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Navbar(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { result, clearResult } = useResultStore();
  const { showToast } = useToast();
  const lastHomeClickRef = useRef<number>(0);

  const handleHomeClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    const now = Date.now();
    const isDoubleClick = now - lastHomeClickRef.current < 500;
    const isAlreadyOnHomeOrResult = location.pathname === '/' || location.pathname === '/result';

    // Click twice (rapid double-click from anywhere, OR 2nd click while already on Home/Result)
    // -> Start fresh from scratch
    if (isDoubleClick || (isAlreadyOnHomeOrResult && (result.media || result.url))) {
      clearResult();
      lastHomeClickRef.current = 0;
      navigate('/', { replace: true });
      showToast('Started fresh', 'Home page reset. Ready for a new URL.', 'info');
      return;
    }

    lastHomeClickRef.current = now;

    // Single click from Downloads or Settings:
    // If a media result was already analyzed, return straight to it!
    if (result.media && result.availability === 'available') {
      navigate('/result');
      return;
    }

    // Otherwise navigate to Home (which retains the previously entered URL)
    navigate('/');
  };

  const isItemActive = (to: string): boolean => {
    if (to === '/') {
      return location.pathname === '/' || location.pathname === '/result';
    }
    return location.pathname.startsWith(to);
  };

  return (
    <header className="sticky top-0 z-40 w-full px-4 pt-4 sm:px-6">
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel mx-auto flex max-w-6xl items-center justify-between px-5 py-3"
      >
        <Link
          to="/"
          onClick={handleHomeClick}
          className="flex items-center gap-2"
          title={
            result.media
              ? 'Media Downloader (Click to view active video • Click twice to start fresh)'
              : 'Media Downloader'
          }
        >
          <span className="text-lg font-bold tracking-tight text-white">Media Downloader</span>
        </Link>

        <div className="flex items-center gap-1 rounded-full border border-glass-border bg-white/5 p-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive = isItemActive(to);
            const isHome = to === '/';

            return (
              <Link
                key={to}
                to={to}
                onClick={isHome ? handleHomeClick : undefined}
                title={
                  isHome && result.media
                    ? 'Home (Click to return to active video • Click twice to start fresh)'
                    : label
                }
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-primary text-white shadow-glow'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </motion.nav>
    </header>
  );
}
