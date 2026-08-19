import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_DEV,
  defaultVariant,
  devSetting,
  type DevSettings,
  type FlairLevel,
  type HoldMode,
  type VariantOf,
} from '@/lib/dev';
import type { ViewName } from '@/lib/machine';
import { applyTheme, themeSetting, type ThemeId } from '@/lib/themes';

// One provider because they share a lifecycle: read once at open, written on change.
type Settings = DevSettings & { theme: ThemeId };

type SettingsApi = {
  settings: Settings;
  setTheme: (theme: ThemeId) => void;
  setFlair: (flair: FlairLevel) => void;
  setHold: (hold: HoldMode) => void;
  setVariant: (view: ViewName, variant: string) => void;
  setOpen: (open: boolean) => void;
};

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    // Nothing renders until this lands, so a dark theme never flashes white first.
    void Promise.all([themeSetting.getValue(), devSetting.getValue()]).then(([theme, dev]) =>
      setSettings({ ...DEFAULT_DEV, ...dev, theme }),
    );
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    // Flair rides the root next to the theme so CSS alone can gate motion on it.
    document.documentElement.dataset.flair = settings.flair;
  }, [settings?.theme, settings?.flair]);

  useEffect(() => {
    if (!settings) return;
    // The first settled value came out of storage; writing it back is a no-op.
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    const { theme, ...dev } = settings;
    void themeSetting.setValue(theme);
    void devSetting.setValue(dev);
  }, [settings]);

  if (!settings) return null;

  const patch = (next: Partial<Settings>) =>
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));

  const api: SettingsApi = {
    settings,
    setTheme: (theme) => patch({ theme }),
    setFlair: (flair) => patch({ flair }),
    setHold: (hold) => patch({ hold }),
    setVariant: (view, variant) => patch({ variants: { ...settings.variants, [view]: variant } }),
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

/** The build flag as well as the default: a stale stored `hold` would freeze a ship. */
export const useHold = (): boolean =>
  import.meta.env.DEV && useSettings().settings.hold === 'hold';

export function useVariant<N extends ViewName>(view: N): VariantOf<N> {
  const { variants } = useSettings().settings;
  return (variants[view] ?? defaultVariant(view)) as VariantOf<N>;
}
