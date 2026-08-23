import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { fetchCourses, type Course } from '@/lib/courses';
import { read, write } from '@/lib/store';

const KEY = 'courses';

type CoursesApi = {
  courses: Course[] | null;
  error: string | null;
  load: () => Promise<boolean>;
};

const CoursesContext = createContext<CoursesApi | null>(null);

export function CoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Signing in rewinds through boot and remounts this; one fetch per open.
  const inflight = useRef<Promise<boolean> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchCourses();
      setCourses(fresh);
      setError(null);
      void write(KEY, fresh);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      inflight.current = null;
    }
  }, []);

  const load = useCallback(() => {
    if (inflight.current) return inflight.current;

    const run = (async () => {
      const cached = await read<Course[]>(KEY);
      const warm = Array.isArray(cached) && cached.length > 0;

      // Courses get added and titles edited, so a cached list is shown and then replaced.
      if (warm) {
        setCourses(cached);
        void refresh();
        return true;
      }

      return refresh();
    })();

    inflight.current = run;
    return run;
  }, [refresh]);

  return (
    <CoursesContext.Provider value={{ courses, error, load }}>{children}</CoursesContext.Provider>
  );
}

export function useCourses(): CoursesApi {
  const api = useContext(CoursesContext);
  if (!api) throw new Error('useCourses called outside CoursesProvider');
  return api;
}
