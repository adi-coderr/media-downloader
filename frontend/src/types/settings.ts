export type ThemeMode = 'dark' | 'light' | 'system';
export type PreferredQuality = 'best' | '1080p' | '720p' | '480p' | 'audio-only';
export type PreferredFormat = 'mp4' | 'webm' | 'mkv' | 'original';
export interface AppSettings {
  theme: ThemeMode;
  defaultDownloadLocation?: string;
  preferredQuality: PreferredQuality;
  preferredFormat: PreferredFormat;
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  preferredQuality: 'best',
  preferredFormat: 'original',
  notificationsEnabled: true,
};
