import { Suspense, useEffect, useState } from 'react';
import { useField } from './settings';
import { FIELD_VIEWS, FULL, MUTED, OFF, type Level } from '@/components/fields';
import type { ViewName } from '@/lib/machine';

/** A moving field beside a lecture pulls the eye exactly where it should not go. */
const LEVELS: Record<ViewName, Level> = {
  boot: FULL,
  signedOut: FULL,
  indexingCourses: FULL,
  home: MUTED,
  search: MUTED,
  courseLoading: MUTED,
  course: MUTED,
  playing: OFF,
};

/** Only snow reports its first drawn frame; the rest come up on the deadline. */
const READY_DEADLINE_MS = 900;

/**
 * One instance for the app's life. Per-screen mounting cost a WebGL init on every
 * transition, and on `boot` that init was the two seconds of black.
 */
export function Backdrop({ view, onReady }: { view: ViewName; onReady: () => void }) {
  const [drawn, setDrawn] = useState(false);
  const field = useField();
  const level = LEVELS[view];

  const settle = () => {
    setDrawn(true);
    onReady();
  };

  useEffect(() => {
    if (drawn) return;
    const deadline = setTimeout(settle, READY_DEADLINE_MS);
    return () => clearTimeout(deadline);
  });

  return (
    <div className="absolute inset-0 bg-paper">
      <Suspense fallback={null}>
        {/* Keyed so switching field tears the old canvas down rather than stacking. */}
        <div
          key={field}
          className="absolute inset-0 transition-opacity duration-700 ease-panel"
          style={{ opacity: drawn ? level.opacity : 0 }}
        >
          {FIELD_VIEWS[field](level, settle)}
        </div>
      </Suspense>
    </div>
  );
}
