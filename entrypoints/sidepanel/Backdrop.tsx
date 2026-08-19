import { Suspense, useEffect, useState } from 'react';
import { FULL, Landscape, landscapeProps, MUTED, OFF, type Level } from '@/components/fields';
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

/** Landscape reports no first frame of its own, so the mark comes up on this. */
const READY_DEADLINE_MS = 900;

/**
 * One instance for the app's life. Per-screen mounting cost a WebGL init on every
 * transition, and on `boot` that init was the two seconds of black.
 */
export function Backdrop({ view, onReady }: { view: ViewName; onReady: () => void }) {
  const [drawn, setDrawn] = useState(false);
  const level = LEVELS[view];

  useEffect(() => {
    if (drawn) return;
    const deadline = setTimeout(() => {
      setDrawn(true);
      onReady();
    }, READY_DEADLINE_MS);
    return () => clearTimeout(deadline);
  });

  return (
    <div className="absolute inset-0 bg-paper">
      <Suspense fallback={null}>
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-panel"
          style={{ opacity: drawn ? level.opacity : 0 }}
        >
          {/* Its root sets no size, so without this the fiber canvas falls back to 300x150. */}
          <Landscape className="h-full w-full" {...landscapeProps(level)} />
        </div>

        {/* The scene moves, so the mark's contrast cannot depend on what is under it. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              'radial-gradient(104% 68% at 50% 47%,',
              `rgba(var(--t-scrim), ${level.vignette}) 0%,`,
              `rgba(var(--t-scrim), ${level.vignette * 0.7}) 34%,`,
              `rgba(var(--t-scrim), ${level.vignette * 0.28}) 62%,`,
              'rgba(var(--t-scrim), 0) 88%)',
            ].join(' '),
          }}
        />
      </Suspense>
    </div>
  );
}
