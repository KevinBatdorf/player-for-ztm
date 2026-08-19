import { storage } from '#imports';

// All four are dark, so `.dark` is unconditional — React Bits blocks key their
// variants off that ancestor class and would otherwise render a light half.
export const THEMES = [
  { id: 'clean', label: 'Clean' },
  { id: 'swiss', label: 'Swiss' },
  { id: 'neobrutalism', label: 'Neobrutalism' },
  { id: 'terminal', label: 'Terminal' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'clean';

export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement) {
  root.dataset.theme = id;
  root.classList.add('dark');
}

// A user setting, not a dev toggle; it outlives the panel that hosts the picker.
export const themeSetting = storage.defineItem<ThemeId>('local:theme', {
  fallback: DEFAULT_THEME,
});
