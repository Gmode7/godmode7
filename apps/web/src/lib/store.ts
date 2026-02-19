// Local storage management for app settings

const STORAGE_KEY = 'gm7-settings';

export interface AppSettings {
  baseUrl: string;
  apiKey: string;
}

const defaultSettings: AppSettings = {
  baseUrl: 'http://127.0.0.1:3000',
  apiKey: '',
};

export function getSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return { ...defaultSettings };
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}
