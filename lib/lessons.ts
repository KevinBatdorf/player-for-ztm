import type { CatalogEntry } from '@/lib/algolia';
import type { CourseId, LessonId } from '@/lib/machine';

const ORIGIN = 'https://academy.zerotomastery.io';

/** One page rather than the enrolled fetch's 900KB, so a shorter deadline. */
const REACH_MS = 12_000;

export type Lesson = {
  id: LessonId;
  title: string;
  /** Only the curriculum carries it; the catalogue's lecture map does not. */
  duration: string | null;
  /** Null until the curriculum is read, which is the whole reason to read it. */
  video: boolean | null;
};

const lessonId = (href: string): LessonId | null => href.match(/\/lectures\/(\d+)/)?.[1] ?? null;

/** Titles arrive with the catalogue, so a course has a list before its page is fetched. */
export const fromCatalog = (entry: CatalogEntry): Lesson[] =>
  entry.lectures.flatMap((lecture) => {
    const id = lessonId(lecture.href);
    return id ? [{ id, title: lecture.title, duration: null, video: null }] : [];
  });

const ITEM = '.block__curriculum__section__list__item__link';
const NAME = '.block__curriculum__section__list__item__lecture-name';
const DURATION = '.block__curriculum__section__list__item__lecture-duration';

/** `slug` filters, because one of their pages can carry more than one course's curriculum. */
export function parseCurriculum(html: string, slug: string): Lesson[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return [...doc.querySelectorAll(ITEM)].flatMap((link) => {
    const href = link.getAttribute('href') ?? '';
    const id = href.startsWith(`/courses/${slug}/lectures/`) ? lessonId(href) : null;
    const title = link.querySelector(NAME)?.textContent?.trim();
    if (!id || !title) return [];

    // Their markup ships the parens; only the digits belong in a meta column.
    const duration = link.querySelector(DURATION)?.textContent?.trim().replace(/^\(|\)$/g, '');

    // `xlink:href` today; the plain attribute is what a markup refresh would leave.
    const icon = link.querySelector('use');
    const ref = icon?.getAttribute('xlink:href') ?? icon?.getAttribute('href') ?? '';

    return [
      {
        id,
        title,
        duration: duration || null,
        // `#icon__Subject` and `#icon__Code` are the two text kinds they use.
        video: ref === '#icon__Video',
      },
    ];
  });
}

/**
 * Signed out, `/courses/<slug>` redirects to a sales page that carries the whole
 * curriculum as markup. Signed in the same URL is a 77KB app shell, so this is the
 * one call in the app that must send no cookies.
 */
export async function fetchCurriculum(slug: string): Promise<Lesson[]> {
  const res = await fetch(`${ORIGIN}/courses/${slug}`, {
    credentials: 'omit',
    signal: AbortSignal.timeout(REACH_MS),
  });

  if (!res.ok) throw new Error(`Curriculum came back ${res.status}.`);

  const lessons = parseCurriculum(await res.text(), slug);
  // Not every slug has a page: some redirect to the public catalogue, which parses to nothing.
  if (!lessons.length) throw new Error('That page carried no curriculum.');

  return lessons;
}

/** Null until a course has been opened, since the catalogue carries no durations. */
export function runtimeOf(lessons: Lesson[]): string | null {
  let seconds = 0;

  for (const lesson of lessons) {
    const parts = lesson.duration?.split(':').map(Number);
    // "1:02:33" and "12:34" both appear; anything else is skipped rather than guessed at.
    if (!parts || parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) continue;
    const [a = 0, b = 0, c] = parts;
    seconds += c === undefined ? a * 60 + b : a * 3600 + b * 60 + c;
  }

  if (!seconds) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Null at the end of the course, which is what sends `playing` back to `course`. */
export function nextOf(lessons: Lesson[], lessonId: LessonId): Lesson | null {
  const at = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (at < 0) return null;

  // Text lessons are unplayable, so auto-advance steps over them rather than stalling.
  return lessons.slice(at + 1).find((lesson) => lesson.video !== false) ?? null;
}

/**
 * `digest` is the catalogue's `contentDigest` this course's curriculum was read at, and
 * null while the lessons are only the catalogue's titles. Holding it per course is what
 * makes "too stale" answerable per course rather than per fetch.
 */
export type Indexed = { digest: string | null; lessons: Lesson[] };

export type LessonIndex = Record<CourseId, Indexed>;

/** A curriculum read survives only while its course has not been edited since. */
export function mergeIndex(
  held: LessonIndex,
  courses: { id: CourseId; updated: string | null }[],
  fresh: Record<CourseId, Lesson[]>,
): LessonIndex {
  const merged: LessonIndex = {};

  for (const course of courses) {
    const known = held[course.id];
    const titles = fresh[course.id];

    if (known?.digest && known.digest === course.updated) merged[course.id] = known;
    else if (titles) merged[course.id] = { digest: null, lessons: titles };
    // No catalogue this time round, so last run's lessons beat none.
    else if (known) merged[course.id] = known;
  }

  return merged;
}
