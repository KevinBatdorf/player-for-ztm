import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchLibrary, type Course } from '@/lib/courses';
import { fetchCurriculum, mergeIndex, type Lesson, type LessonIndex } from '@/lib/lessons';
import type { CourseId } from '@/lib/machine';
import { read, write } from '@/lib/store';

const COURSES = 'courses';
const LESSONS = 'lessons';

type LibraryApi = {
  courses: Course[] | null;
  error: string | null;
  load: () => Promise<boolean>;
  /** Titles as soon as the catalogue lands; durations once `openCourse` has run. */
  lessonsFor: (courseId: CourseId) => Lesson[];
  /** The one curriculum fetch per course, skipped when the cache is at the same digest. */
  openCourse: (courseId: CourseId) => Promise<void>;
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
  // The writes are whole-record, so they read the latest without waiting on a render.
  const latest = useRef<LessonIndex>({});

  const put = useCallback((next: LessonIndex) => {
    latest.current = next;
    setIndex(next);
    void write(LESSONS, next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchLibrary();
      setCourses(fresh.courses);
      setError(null);
      void write(COURSES, fresh.courses);

      put(mergeIndex(latest.current, fresh.courses, fresh.lessons));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      inflight.current = null;
    }
  }, [put]);

  const load = useCallback(() => {
    if (inflight.current) return inflight.current;

    const run = (async () => {
      const [cachedCourses, cachedIndex] = await Promise.all([
        read<Course[]>(COURSES),
        read<LessonIndex>(LESSONS),
      ]);

      if (cachedIndex) {
        latest.current = cachedIndex;
        setIndex(cachedIndex);
      }

      const warm = Array.isArray(cachedCourses) && cachedCourses.length > 0;

      // Courses get added and titles edited, so a cached list is shown and then replaced.
      if (warm) {
        setCourses(cachedCourses);
        void refresh();
        return true;
      }

      return refresh();
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

  const api = useMemo<LibraryApi>(
    () => ({
      courses,
      error,
      load,
      lessonsFor: (courseId) => index[courseId]?.lessons ?? NONE,
      openCourse,
    }),
    [courses, error, load, index, openCourse],
  );

  return <LibraryContext.Provider value={api}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryApi {
  const api = useContext(LibraryContext);
  if (!api) throw new Error('useLibrary called outside LibraryProvider');
  return api;
}
