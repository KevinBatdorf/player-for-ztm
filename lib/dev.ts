import { storage } from '#imports';
import { SAMPLE_COURSE, SAMPLE_LESSON } from '@/lib/fixtures';
import type { View, ViewName } from '@/lib/machine';

/** Motion and ornament budget. `none` doubles as the reduced-motion escape hatch. */
export const FLAIR_LEVELS = ['none', 'subtle', 'full'] as const;

export type FlairLevel = (typeof FLAIR_LEVELS)[number];

// A record, not a list: the compiler then refuses a screen with no treatments.
export const VIEW_VARIANTS = {
  boot: ['wordmark', 'bars'],
  signedOut: ['card', 'steps'],
  indexingCourses: ['plain'],
  home: ['list', 'deck'],
  search: ['plain'],
  courseLoading: ['plain'],
  course: ['plain'],
  playing: ['plain'],
} as const satisfies Record<ViewName, readonly [string, ...string[]]>;

export type VariantOf<N extends ViewName> = (typeof VIEW_VARIANTS)[N][number];

/** Flow order, because the dev panel's state list reads as the flow. */
export const VIEW_NAMES = Object.keys(VIEW_VARIANTS) as ViewName[];

// Widened: TS will not map over a union of readonly tuples.
export const variantsFor = (name: ViewName): readonly string[] => VIEW_VARIANTS[name];

export const defaultVariant = <N extends ViewName>(name: N): VariantOf<N> =>
  VIEW_VARIANTS[name][0] as VariantOf<N>;

/** Placeholder payloads, so states carrying one are still a single click away. */
export function sampleView(name: ViewName): View {
  switch (name) {
    case 'boot':
      return { name: 'boot' };
    case 'signedOut':
      return { name: 'signedOut' };
    case 'indexingCourses':
      return { name: 'indexingCourses' };
    case 'home':
      return { name: 'home' };
    case 'search':
      return { name: 'search', query: 'async' };
    case 'courseLoading':
      return { name: 'courseLoading', courseId: SAMPLE_COURSE.id };
    case 'course':
      return { name: 'course', courseId: SAMPLE_COURSE.id };
    case 'playing':
      return { name: 'playing', courseId: SAMPLE_COURSE.id, lessonId: SAMPLE_LESSON.id };
  }
}

/** Freezes the automatic transitions, so a screen that leaves after 620ms can be read. */
export const HOLD_MODES = ['auto', 'hold'] as const;

export type HoldMode = (typeof HOLD_MODES)[number];

export type DevSettings = {
  open: boolean;
  flair: FlairLevel;
  hold: HoldMode;
  variants: { [N in ViewName]?: VariantOf<N> };
};

export const DEFAULT_DEV: DevSettings = {
  open: false,
  flair: 'subtle',
  hold: 'auto',
  variants: {},
};

export const devSetting = storage.defineItem<DevSettings>('local:dev', { fallback: DEFAULT_DEV });
