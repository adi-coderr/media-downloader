import { motion } from 'framer-motion';
import { Bell, Gauge, RotateCcw, Video } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { SettingsRow, SelectField, ToggleField } from '@/components/SettingsControls';
import { useToast } from '@/context/ToastContext';

export function SettingsPage(): JSX.Element {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { showToast } = useToast();

  const handleReset = (): void => {
    resetSettings();
    showToast('Settings reset', 'All preferences restored to defaults.', 'info');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-white"
        >
          Settings
        </motion.h1>
        <button type="button" onClick={handleReset} className="btn-secondary text-sm">
          <RotateCcw className="h-4 w-4" />
          Reset to defaults
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-panel px-6">
        <SettingsRow
          icon={Gauge}
          label="Preferred quality"
          description="Used to pre-select the closest matching stream."
        >
          <SelectField
            value={settings.preferredQuality}
            onChange={(value) => updateSettings({ preferredQuality: value })}
            options={[
              { value: 'best', label: 'Best available' },
              { value: '1080p', label: '1080p' },
              { value: '720p', label: '720p' },
              { value: '480p', label: '480p' },
              { value: 'audio-only', label: 'Audio only' },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          icon={Video}
          label="Preferred format"
          description="Used to pre-select the closest matching container."
        >
          <SelectField
            value={settings.preferredFormat}
            onChange={(value) => updateSettings({ preferredFormat: value })}
            options={[
              { value: 'original', label: 'Original (as provided)' },
              { value: 'mp4', label: 'MP4' },
              { value: 'webm', label: 'WebM' },
              { value: 'mkv', label: 'MKV' },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          icon={Bell}
          label="Notifications"
          description="Show a toast when a download completes or fails."
        >
          <ToggleField
            checked={settings.notificationsEnabled}
            onChange={(checked) => updateSettings({ notificationsEnabled: checked })}
          />
        </SettingsRow>
      </motion.div>
    </div>
  );
}
