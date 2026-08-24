import { storage } from '#imports';
import type { CourseId, View, ViewName } from '@/lib/machine';

// A record, not a list: the compiler then refuses a screen left out of the jump list.
const IN_FLOW = {
  boot: true,
  signedOut: true,
  indexingCourses: true,
  home: true,
  search: true,
  courseLoading: true,
  course: true,
} satisfies Record<ViewName, true>;

/** Flow order, because the dev panel's state list reads as the flow. */
export const VIEW_NAMES = Object.keys(IN_FLOW) as ViewName[];

export function sampleView(name: ViewName, courseId: CourseId): View {
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
      return { name: 'courseLoading', courseId };
    case 'course':
      return { name: 'course', courseId };
  }
}

export type DevSettings = {
  open: boolean;
  /** Freezes the automatic transitions, so a screen that leaves after 620ms can be read. */
  held: boolean;
};

export const DEFAULT_DEV: DevSettings = {
  open: false,
  held: false,
};

export const devSetting = storage.defineItem<DevSettings>('local:dev', { fallback: DEFAULT_DEV });
