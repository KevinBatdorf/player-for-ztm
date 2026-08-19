import { lazy, Suspense, useState } from 'react';
import { ZTM_GREEN } from '@/lib/brand';
import type { ViewName } from '@/lib/machine';

const PixelSnow = lazy(() => import('@/components/react-bits/pixel-snow'));

type Level = { opacity: number; brightness: number; speed: number; depthFade: number };

const FULL: Level = { opacity: 0.9, brightness: 1.5, speed: 0.7, depthFade: 8 };
const MUTED: Level = { opacity: 0.45, brightness: 0.7, speed: 0.22, depthFade: 2.5 };
const OFF: Level = { opacity: 0, brightness: 0, speed: 0, depthFade: 0 };

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

/**
 * One instance for the app's life. Per-screen mounting cost a WebGL init on every
 * transition, and on `boot` that init was the two seconds of black.
 */
export function Backdrop({ view, onReady }: { view: ViewName; onReady: () => void }) {
  const [drawn, setDrawn] = useState(false);
  const level = LEVELS[view];

  return (
    <div className="absolute inset-0 bg-paper">
      <Suspense fallback={null}>
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-panel"
          style={{ opacity: drawn ? level.opacity : 0 }}
        >
          {/* Props reach the shader as uniforms, so a level change is not a remount. */}
          <PixelSnow
            color={ZTM_GREEN}
            variant="square"
            density={0.95}
            pixelResolution={120}
            direction={165}
            brightness={level.brightness}
            speed={level.speed}
            depthFade={level.depthFade}
            onReady={() => {
              setDrawn(true);
              onReady();
            }}
          />
        </div>
      </Suspense>
    </div>
  );
}
