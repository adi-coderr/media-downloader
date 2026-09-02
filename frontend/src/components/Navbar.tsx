import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Home, Settings as SettingsIcon } from 'lucide-react';
import { useDownloads } from '@/context/DownloadContext';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/downloads', label: 'Downloads', icon: Download },
];

export function Navbar(): JSX.Element {
  const { jobs } = useDownloads();
  const activeCount = jobs.filter((job) => job.status === 'queued' || job.status === 'downloading').length;
  return (
    <header className="sticky top-0 z-40 w-full px-4 pt-4 sm:px-6">
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel mx-auto flex max-w-6xl items-center justify-between px-5 py-3"
      >
        <NavLink to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-white">
            Media Downloader
          </span>
        </NavLink>

        <div className="flex items-center gap-1 rounded-full border border-glass-border bg-white/5 p-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                  isActive ? 'bg-primary text-white shadow-glow' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              {label === 'Downloads' && activeCount > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{activeCount}</span>}
            </NavLink>
          ))}
        </div>
      </motion.nav>
    </header>
  );
}
