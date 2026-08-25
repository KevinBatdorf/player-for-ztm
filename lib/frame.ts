import type { LessonId } from '@/lib/machine';

export const FRAME_ORIGIN = 'https://player.hotmart.com';

/** It loads before it can be messaged, so the first lesson rides the URL. */
export const framed = (embed: string, lessonId: LessonId) => `${embed}#ztm:${lessonId}`;

export const lessonInHash = (hash: string): LessonId => hash.match(/#ztm:(\w+)/)?.[1] ?? '';

export type Swap = { ztm: 'swap'; lessonId: LessonId; src: string; play: boolean };

/** A foreign document we own the element of, so postMessage is the whole channel. */
export type ToFrame =
  | Swap
  /** The frame ignores it while the video is popped out. */
  | { ztm: 'pause' }
  /** A frame that has just loaded holds on its first frame until this arrives. */
  | { ztm: 'play' };

export type FromFrame =
  | { ztm: 'ready'; lessonId: LessonId }
  | { ztm: 'playing'; lessonId: LessonId }
  | { ztm: 'paused'; lessonId: LessonId }
  /** `covered` is seconds watched, not a position. */
  | { ztm: 'progress'; lessonId: LessonId; covered: number; duration: number | null }
  | { ztm: 'ended'; lessonId: LessonId }
  | { ztm: 'failed'; lessonId: LessonId; message: string };

export const fromFrame = (data: unknown): FromFrame | null =>
  data && typeof data === 'object' && 'ztm' in data ? (data as FromFrame) : null;
