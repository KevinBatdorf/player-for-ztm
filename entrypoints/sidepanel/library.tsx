import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CatalogEntry } from '@/lib/algolia';
import { fetchLibrary, type Course } from '@/lib/courses';
import { fetchCurriculum, mergeIndex, type Lesson, type LessonIndex } from '@/lib/lessons';
import { fetchLectureBody } from '@/lib/lecture';
import type { CourseId, LessonId } from '@/lib/machine';
import { read, write } from '@/lib/store';
import { mark, resumeOf, type Watched } from '@/lib/watched';

const COURSES = 'courses';
const CATALOG = 'catalog';
const LESSONS = 'lessons';
const WATCHED = 'watched';
const LAST = 'last';

/** Per course, so opening one reads its own bodies instead of every course's. */
const bodyKey = (courseId: CourseId) => `text:${courseId}`;

/** Slow on purpose: this host answers with a reCAPTCHA when it is pushed. */
const SWEEP_GAP_MS = 1200;

/** A second failure in a row is the host saying no, not one bad lecture. */
const GIVE_UP_AFTER = 2;

/** A floor, not a duration: the shelf read usually holds the notice up far longer. */
const ARRIVAL_FLOOR_MS = 3000;

const ARRIVAL_HOLD_MS = 900;

/** What the player had loaded when the panel last closed. */
export type Playing = { courseId: CourseId; lessonId: LessonId };

type Bodies = { digest: string | null; bodies: Record<LessonId, string> };

type LibraryApi = {
  courses: Course[] | null;
  error: string | null;
  load: () => Promise<boolean>;
  /** Titles as soon as the catalogue lands; durations once `openCourse` has run. */
  lessonsFor: (courseId: CourseId) => Lesson[];
  /** The one curriculum fetch per course, skipped when the cache is at the same digest. */
  openCourse: (courseId: CourseId) => Promise<void>;
  /** Only one course sweeps at a time; a second call abandons the first. */
  sweepText: (courseId: CourseId) => void;
  /** Deduped, so asking for a lecture already in flight costs nothing. */
  readLesson: (courseId: CourseId, lessonId: LessonId) => void;
  bodyFor: (courseId: CourseId, lessonId: LessonId) => string | undefined;
  seen: (courseId: CourseId, lessonId: LessonId) => boolean;
  watchedCount: (courseId: CourseId) => number;
  markWatched: (courseId: CourseId, lessonId: LessonId) => void;
  resumeIn: (courseId: CourseId) => Lesson | null;
  /** Up from the page that first gives up an unheld course until its card has landed. */
  arriving: boolean;
  /** The ids that just landed, for as long as their entrance runs. */
  landed: CourseId[];
  /** What each page of the shelf gave up on the last fetch. */
  pages: number[];
  catalog: CatalogEntry[];
  /** Null until the cache is read, so the card does not flash in and out on boot. */
  lastPlayed: Playing | null;
  remember: (courseId: CourseId, lessonId: LessonId) => void;
};

const LibraryContext = createContext<LibraryApi | null>(null);

const NONE: Lesson[] = [];

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [index, setIndex] = useState<LessonIndex>({});
  const [error, setError] = useState<string | null>(null);
  // Signing in rewinds through boot and remounts this; one fetch per open.
  const inflight = useRef<Promise<boolean> | null>(null);
  const opening = useRef(new Map<CourseId, Promise<void>>());
  const [text, setText] = useState<Record<CourseId, Bodies>>({});
  const [watched, setWatched] = useState<Watched>({});
  const [lastPlayed, setLastPlayed] = useState<Playing | null>(null);
  const [pages, setPages] = useState<number[]>([]);
  const [arriving, setArriving] = useState(false);
  const [landed, setLanded] = useState<CourseId[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const record = useRef<Watched>({});
  const sweeping = useRef<CourseId | null>(null);
  const reading = useRef(new Set<LessonId>());
  // The writes are whole-record, so they read the latest without waiting on a render.
  const latest = useRef<LessonIndex>({});

  const put = useCallback((next: LessonIndex) => {
    latest.current = next;
    setIndex(next);
    void write(LESSONS, next);
  }, []);

  const refresh = useCallback(
    async (known: CourseId[]) => {
      const shelf = new Set(known);
      let noticed: number | null = null;

      try {
        const fresh = await fetchLibrary(
          // A first-ever read has nothing to compare against, so none of it is an arrival.
          shelf.size
            ? {
                known: shelf,
                onArrival: () => {
                  noticed = Date.now();
                  setArriving(true);
                },
              }
            : undefined,
        );

        const fresher = shelf.size ? fresh.courses.filter((course) => !shelf.has(course.id)) : [];

        // Held back on purpose: the cards must not land while the notice is still up.
        if (noticed !== null) {
          const left = ARRIVAL_FLOOR_MS - (Date.now() - noticed);
          if (left > 0) await new Promise((done) => setTimeout(done, left));
        }

        setCourses(fresh.courses);
        setPages(fresh.pages);
        setCatalog(fresh.catalog);
        setError(null);
        setArriving(false);
        setLanded(fresher.map((course) => course.id));
        void write(COURSES, fresh.courses);
        void write(CATALOG, fresh.catalog);

        put(mergeIndex(latest.current, fresh.courses, fresh.lessons));
        return true;
      } catch (cause) {
        setArriving(false);
        setError(cause instanceof Error ? cause.message : String(cause));
        return false;
      } finally {
        inflight.current = null;
      }
    },
    [put],
  );

  // Cleared, or a card remounting out of a search filter replays the entrance.
  useEffect(() => {
    if (!landed.length) return;
    const timer = setTimeout(() => setLanded([]), ARRIVAL_HOLD_MS);
    return () => clearTimeout(timer);
  }, [landed]);

  const load = useCallback(() => {
    if (inflight.current) return inflight.current;

    const run = (async () => {
      const [cachedCourses, cachedIndex, cachedWatched, cachedLast, cachedCatalog] =
        await Promise.all([
          read<Course[]>(COURSES),
          read<LessonIndex>(LESSONS),
          read<Watched>(WATCHED),
          read<Playing>(LAST),
          read<CatalogEntry[]>(CATALOG),
        ]);

      if (cachedLast) setLastPlayed(cachedLast);
      if (cachedCatalog) setCatalog(cachedCatalog);

      if (cachedIndex) {
        latest.current = cachedIndex;
        setIndex(cachedIndex);
      }

      if (cachedWatched) {
        record.current = cachedWatched;
        setWatched(cachedWatched);
      }

      // Courses get added and titles edited, so a cached list is shown and then replaced.
      if (Array.isArray(cachedCourses) && cachedCourses.length > 0) {
        setCourses(cachedCourses);
        void refresh(cachedCourses.map((course) => course.id));
        return true;
      }

      return refresh([]);
    })();

    inflight.current = run;
    return run;
  }, [refresh]);

  const openCourse = useCallback(
    (courseId: CourseId) => {
      const running = opening.current.get(courseId);
      if (running) return running;

      const course = courses?.find((c) => c.id === courseId);
      const held = latest.current[courseId];

      // Nothing to fetch: an onboarding tile has no slug, and a matching digest is current.
      if (!course?.slug || !course.updated || held?.digest === course.updated) {
        return Promise.resolve();
      }

      const { slug, updated } = course;

      const run = fetchCurriculum(slug)
        .then((lessons) => {
          put({ ...latest.current, [courseId]: { digest: updated, lessons } });
        })
        // Failing costs durations, not the list: the catalogue's titles stay put.
        .catch(() => undefined)
        .finally(() => {
          opening.current.delete(courseId);
        });

      opening.current.set(courseId, run);
      return run;
    },
    [courses, put],
  );


  const keep = useCallback((courseId: CourseId, digest: string | null, lessonId: LessonId, body: string) => {
    setText((prev) => {
      const held = prev[courseId]?.digest === digest ? prev[courseId] : { digest, bodies: {} };
      const next = { digest, bodies: { ...held.bodies, [lessonId]: body } };
      void write(bodyKey(courseId), next);
      return { ...prev, [courseId]: next };
    });
  }, []);

  const readLesson = useCallback(
    (courseId: CourseId, lessonId: LessonId) => {
      const course = courses?.find((c) => c.id === courseId);
      if (!course?.slug || reading.current.has(lessonId)) return;

      reading.current.add(lessonId);
      const { slug, updated } = course;

      void fetchLectureBody(courseId, slug, lessonId)
        .then((body) => keep(courseId, updated, lessonId, body))
        // A failure and an empty lecture look the same to the reader.
        .catch(() => undefined)
        .finally(() => reading.current.delete(lessonId));
    },
    [courses, keep],
  );

  const sweepText = useCallback(
    (courseId: CourseId) => {
      if (sweeping.current === courseId) return;
      sweeping.current = courseId;

      void (async () => {
        const course = courses?.find((c) => c.id === courseId);
        if (!course?.slug) return;
        const { slug, updated } = course;

        const cached = await read<Bodies>(bodyKey(courseId));
        // A course edit invalidates its bodies too.
        const held: Bodies =
          cached && cached.digest === updated ? cached : { digest: updated, bodies: {} };

        setText((prev) => ({ ...prev, [courseId]: held }));

        const wanted = (latest.current[courseId]?.lessons ?? []).filter(
          (lesson) => lesson.video === false && held.bodies[lesson.id] === undefined,
        );

        let missed = 0;

        for (const lesson of wanted) {
          if (sweeping.current !== courseId) return;

          let body: string;
          try {
            body = await fetchLectureBody(courseId, slug, lesson.id);
          } catch {
            missed += 1;
            if (missed >= GIVE_UP_AFTER) break;
            continue;
          }

          missed = 0;
          keep(courseId, updated, lesson.id, body);

          await new Promise((done) => setTimeout(done, SWEEP_GAP_MS));
        }
      })();
    },
    [courses, keep],
  );

  // Every progress tick past the threshold says the same thing, so only the first writes.
  const markWatched = useCallback((courseId: CourseId, lessonId: LessonId) => {
    if (record.current[courseId]?.[lessonId]) return;
    const next = mark(record.current, courseId, lessonId);
    record.current = next;
    setWatched(next);
    void write(WATCHED, next);
  }, []);

  const remember = useCallback((courseId: CourseId, lessonId: LessonId) => {
    const playing = { courseId, lessonId };
    setLastPlayed(playing);
    void write(LAST, playing);
  }, []);

  const api = useMemo<LibraryApi>(
    () => ({
      courses,
      error,
      load,
      lessonsFor: (courseId) => index[courseId]?.lessons ?? NONE,
      openCourse,
      sweepText,
      readLesson,
      bodyFor: (courseId, lessonId) => text[courseId]?.bodies[lessonId],
      seen: (courseId, lessonId) => !!watched[courseId]?.[lessonId],
      watchedCount: (courseId) => Object.keys(watched[courseId] ?? {}).length,
      markWatched,
      resumeIn: (courseId) => resumeOf(index[courseId]?.lessons ?? NONE, watched[courseId]),
      arriving,
      landed,
      pages,
      catalog,
      lastPlayed,
      remember,
    }),
    [
      courses,
      error,
      load,
      index,
      openCourse,
      sweepText,
      readLesson,
      text,
      watched,
      markWatched,
      arriving,
      landed,
      pages,
      catalog,
      lastPlayed,
      remember,
    ],
  );

  return <LibraryContext.Provider value={api}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryApi {
  const api = useContext(LibraryContext);
  if (!api) throw new Error('useLibrary called outside LibraryProvider');
  return api;
}
