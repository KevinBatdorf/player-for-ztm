import { fetchCatalog, type CatalogEntry } from '@/lib/algolia';
import { fromCatalog, type Lesson } from '@/lib/lessons';
import type { CourseId } from '@/lib/machine';

const ORIGIN = 'https://academy.zerotomastery.io';

/** Signed out this 302s to the public catalogue, so a cookie-less read is silently wrong. */
const ENROLLED = `${ORIGIN}/courses/enrolled`;

const REACH_MS = 15_000;

export type Course = {
  id: CourseId;
  title: string;
  image: string;
  /** Null for the four "Step N" tiles, which are onboarding cards and not courses. */
  slug: string | null;
  updated: string | null;
};

type Enrolled = { id: CourseId; title: string; image: string };

/** The progress bar these cards also carry ships hidden and empty on every course. */
export function parseEnrolled(html: string): Enrolled[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return [...doc.querySelectorAll('a[data-role="course-box-link"]')].flatMap((box) => {
    const id = box.getAttribute('href')?.match(/\/courses\/enrolled\/(\d+)/)?.[1];
    const title = box.querySelector('.course-listing-title')?.textContent?.trim();
    if (!id || !title) return [];

    return [{ id, title, image: box.querySelector('img.course-box-image')?.getAttribute('src') ?? '' }];
  });
}

/** Teachable numbers enrolled courses, Contentful keys them by slug; only the title bridges. */
const normalize = (title: string) =>
  title
    .toLowerCase()
    .replace(/\bin \d{4}\b/g, '')
    .replace(/\bzero to mastery\b/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Bigram overlap, so the long prefix these titles share does not carry a match. */
function similarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const pairs = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const pair = s.slice(i, i + 2);
      out.set(pair, (out.get(pair) ?? 0) + 1);
    }
    return out;
  };

  const left = pairs(a);
  let shared = 0;
  for (const [pair, count] of pairs(b)) shared += Math.min(count, left.get(pair) ?? 0);

  return (2 * shared) / (a.length - 1 + b.length - 1);
}

/** Below this, "AWS Certified Cloud Practitioner" starts matching "AWS Certified Solutions Architect". */
const CLOSE_ENOUGH = 0.8;

function match(title: string, catalog: CatalogEntry[]): CatalogEntry | null {
  const want = normalize(title);
  if (!want) return null;

  const keyed = catalog.map((entry) => ({ entry, key: normalize(entry.title) }));

  const exact = keyed.find((row) => row.key === want);
  if (exact) return exact.entry;

  // "The Complete Web Developer" against "Complete Web Developer" — one is inside the other.
  const held = keyed.find(
    (row) => row.key.length > 8 && (row.key.includes(want) || want.includes(row.key)),
  );
  if (held) return held.entry;

  let best: { entry: CatalogEntry; score: number } | null = null;
  for (const row of keyed) {
    const score = similarity(want, row.key);
    if (!best || score > best.score) best = { entry: row.entry, score };
  }

  return best && best.score >= CLOSE_ENOUGH ? best.entry : null;
}

/** Every enrolled course's lessons, keyed the way the views hold a course. */
export type Library = { courses: Course[]; lessons: Record<CourseId, Lesson[]> };

/** A catalogue failure costs the order and the lessons, not the list. */
/** Their shelf paginates, so a single read is only ever the first page of it. */
const PAGES = 20;

async function fetchEnrolled(): Promise<Enrolled[]> {
  const held: Enrolled[] = [];
  const seen = new Set<CourseId>();

  for (let page = 1; page <= PAGES; page++) {
    const res = await fetch(page === 1 ? ENROLLED : `${ENROLLED}?page=${page}`, {
      credentials: 'include',
      signal: AbortSignal.timeout(REACH_MS),
    });

    if (!res.ok) throw new Error(`Enrolled came back ${res.status}.`);
    if (!new URL(res.url).pathname.startsWith('/courses/enrolled')) {
      throw new Error('Enrolled redirected to the public catalogue, so the session is gone.');
    }

    const rows = parseEnrolled(await res.text());
    // A page past the end repeats the last one on some of their layouts, so ids decide.
    const fresh = rows.filter((course) => !seen.has(course.id));
    console.info(`[ztm] enrolled page ${page}: ${rows.length} tiles, ${fresh.length} new`);
    if (!fresh.length) break;

    for (const course of fresh) seen.add(course.id);
    held.push(...fresh);
  }

  return held;
}

export async function fetchLibrary(): Promise<Library> {
  const enrolled = await fetchEnrolled();
  if (!enrolled.length) throw new Error('Enrolled parsed to nothing, so their markup moved.');

  const catalog = await fetchCatalog().catch(() => [] as CatalogEntry[]);

  const lessons: Record<CourseId, Lesson[]> = {};

  const courses = enrolled.map((course) => {
    const hit = catalog.length ? match(course.title, catalog) : null;
    // The four `Step N` tiles never match, so they carry no lessons either.
    if (hit) lessons[course.id] = fromCatalog(hit);

    return { ...course, slug: hit?.slug ?? null, updated: hit?.updated || null };
  });

  return { courses, lessons };
}

/** Newest edit first; the tiles with no catalogue match sort last. */
export const byUpdated = (courses: Course[]): Course[] =>
  [...courses].sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''));
