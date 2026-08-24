import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_DEV, devSetting, type DevSettings, type FlairLevel } from '@/lib/dev';

type SettingsApi = {
  settings: DevSettings;
  setHeld: (held: boolean) => void;
  setOpen: (open: boolean) => void;
};

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DevSettings | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    // Nothing renders until this lands, so the panel never paints on a default first.
    void devSetting.getValue().then((dev) => setSettings({ ...DEFAULT_DEV, ...dev }));
  }, []);

  useEffect(() => {
    if (!settings) return;
    // On the root so CSS alone can gate motion on it.
    document.documentElement.dataset.flair = settings.flair;
  }, [settings?.flair]);

  useEffect(() => {
    if (!settings) return;
    // The first settled value came out of storage; writing it back is a no-op.
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    void devSetting.setValue(settings);
  }, [settings]);

  if (!settings) return null;

  const patch = (next: Partial<DevSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));

  const api: SettingsApi = {
    settings,
    setHeld: (held) => patch({ held }),
    setOpen: (open) => patch({ open }),
  };

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext);
  if (!api) throw new Error('useSettings called outside SettingsProvider');
  return api;
}

export const useFlair = (): FlairLevel => useSettings().settings.flair;

/** Defaults off, or a stale stored value would freeze a ship. */
export const useHold = (): boolean => useSettings().settings.held;
