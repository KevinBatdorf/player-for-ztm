import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_DEV,
  defaultVariant,
  devSetting,
  type DevSettings,
  type FieldId,
  type FlairLevel,
  type HoldMode,
  type VariantOf,
} from '@/lib/dev';
import type { ViewName } from '@/lib/machine';

type SettingsApi = {
  settings: DevSettings;
  setFlair: (flair: FlairLevel) => void;
  setField: (field: FieldId) => void;
  setHold: (hold: HoldMode) => void;
  setVariant: (view: ViewName, variant: string) => void;
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
    setFlair: (flair) => patch({ flair }),
    setField: (field) => patch({ field }),
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

export const useField = (): FieldId => useSettings().settings.field;

/** The build flag as well as the default: a stale stored `hold` would freeze a ship. */
export const useHold = (): boolean => useSettings().settings.hold === 'hold';

export function useVariant<N extends ViewName>(view: N): VariantOf<N> {
  const { variants } = useSettings().settings;
  return (variants[view] ?? defaultVariant(view)) as VariantOf<N>;
}
