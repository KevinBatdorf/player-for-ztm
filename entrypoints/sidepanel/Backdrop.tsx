import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useField } from './settings';
import { ZTM_GREEN, ZTM_PINK, ZTM_PURPLE } from '@/lib/brand';
import type { FieldId } from '@/lib/dev';
import type { ViewName } from '@/lib/machine';

const PixelSnow = lazy(() => import('@/components/react-bits/pixel-snow'));
const LetterGlitch = lazy(() => import('@/components/react-bits/letter-glitch'));
const GlitterWarp = lazy(() => import('@/components/react-bits/glitter-warp'));
const Landscape = lazy(() => import('@/components/react-bits/landscape'));
const FallingRays = lazy(() => import('@/components/react-bits/falling-rays'));

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

/** Only snow reports its first drawn frame; the rest come up on the deadline. */
const READY_DEADLINE_MS = 900;

/** Each field reads `level` for intensity and calls `ready` once it has drawn. */
const FIELD_VIEWS: Record<FieldId, (level: Level, ready: () => void) => ReactNode> = {
  snow: (level, ready) => (
    <PixelSnow
      color={ZTM_GREEN}
      variant="square"
      density={0.95}
      pixelResolution={120}
      direction={165}
      brightness={level.brightness}
      speed={level.speed}
      depthFade={level.depthFade}
      onReady={ready}
    />
  ),
  glitch: (level) => (
    <LetterGlitch
      glitchColors={[ZTM_GREEN, ZTM_PINK, ZTM_PURPLE]}
      glitchSpeed={level.speed > 0.4 ? 45 : 140}
      centerVignette
      outerVignette={false}
    />
  ),
  warp: (level) => (
    <GlitterWarp
      speed={level.speed}
      color={ZTM_GREEN}
      brightness={level.brightness}
      density={2.2}
    />
  ),
  // Its own purple-to-magenta ramp; forcing the brand green flattened it to black.
  landscape: (level) => (
    <Landscape speed={level.speed} pitch={-0.25} altitude={2.6} elevation={6} fogStart={34} />
  ),
  // No speed prop; the pulse is what moves, so the level rides that instead.
  rays: (level) => (
    <FallingRays
      color1={ZTM_GREEN}
      color2={ZTM_PINK}
      rayCount={64}
      rayWidth={0.009}
      pulseSpeed={level.speed}
    />
  ),
};

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
