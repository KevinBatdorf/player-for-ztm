import type { Lesson } from '@/lib/lessons';
import type { CourseId, LessonId } from '@/lib/machine';

/** Watching through our own embed bypasses the page that would report progress to them. */
export type Watched = Record<CourseId, Record<LessonId, number>>;

/** Teachable reads completion from coverage as well, not from a position. */
const DONE_AT = 0.9;

export const isDone = (covered: number, duration: number | null): boolean =>
  !!duration && duration > 0 && covered / duration >= DONE_AT;

export const mark = (held: Watched, courseId: CourseId, lessonId: LessonId): Watched => ({
  ...held,
  [courseId]: { ...held[courseId], [lessonId]: Date.now() },
});

export function resumeOf(lessons: Lesson[], done: Record<LessonId, number> = {}): Lesson | null {
  // Text lessons are unplayable, so they neither resume nor block what follows.
  const videos = lessons.filter((lesson) => lesson.video !== false);
  return videos.find((lesson) => !done[lesson.id]) ?? videos[0] ?? null;
}
