import { storage } from '#imports';

// `dark` is separate because React Bits blocks key their variants off an ancestor class.
export const THEMES = [
  { id: 'clean', label: 'Clean', dark: false },
  { id: 'swiss', label: 'Swiss', dark: false },
  { id: 'neobrutalism', label: 'Neobrutalism', dark: false },
  { id: 'terminal', label: 'Terminal', dark: true },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'clean';

export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement) {
  root.dataset.theme = id;
  root.classList.toggle('dark', THEMES.find((t) => t.id === id)?.dark === true);
}

// A user setting, not a dev toggle; it outlives the panel that hosts the picker.
export const themeSetting = storage.defineItem<ThemeId>('local:theme', {
  fallback: DEFAULT_THEME,
});
