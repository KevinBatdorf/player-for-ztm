import { useCallback, useEffect, useRef } from 'react';
import { useLibrary } from './library';
import type { CourseId } from '@/lib/machine';

/** Below this, dragging the pointer down a list of 35 cards would fetch all 35. */
const DWELL_MS = 75;

/** Safe to fire freely: `openCourse` dedupes in flight and no-ops on a matching digest. */
export function useHoverPrefetch() {
  const { openCourse } = useLibrary();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancel = useCallback(() => clearTimeout(timer.current), []);

  useEffect(() => cancel, [cancel]);

  return useCallback(
    (courseId: CourseId) => ({
      onPointerEnter: () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void openCourse(courseId), DWELL_MS);
      },
      onPointerLeave: cancel,
    }),
    [openCourse, cancel],
  );
}
