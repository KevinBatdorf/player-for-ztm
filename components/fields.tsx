import { lazy, type ReactNode } from 'react';
import { ZTM_GREEN, ZTM_PINK, ZTM_PURPLE } from '@/lib/brand';
import type { FieldId } from '@/lib/dev';

const PixelSnow = lazy(() => import('@/components/react-bits/pixel-snow'));
const LetterGlitch = lazy(() => import('@/components/react-bits/letter-glitch'));
const GlitterWarp = lazy(() => import('@/components/react-bits/glitter-warp'));
const Landscape = lazy(() => import('@/components/react-bits/landscape'));
const FallingRays = lazy(() => import('@/components/react-bits/falling-rays'));

export type Level = { opacity: number; brightness: number; speed: number; depthFade: number };

export const FULL: Level = { opacity: 0.9, brightness: 1.5, speed: 0.7, depthFade: 8 };
export const MUTED: Level = { opacity: 0.45, brightness: 0.7, speed: 0.22, depthFade: 2.5 };
export const OFF: Level = { opacity: 0, brightness: 0, speed: 0, depthFade: 0 };

/** Each field reads `level` for intensity and calls `ready` once it has drawn. */
export const FIELD_VIEWS: Record<FieldId, (level: Level, ready: () => void) => ReactNode> = {
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
    <GlitterWarp speed={level.speed} color={ZTM_GREEN} brightness={level.brightness} density={2.2} />
  ),
  // Its own purple-to-magenta ramp; forcing the brand green flattened it to black.
  landscape: (level) => (
    // Its root sets no size, so without this the fiber canvas falls back to 300x150.
    <Landscape className="h-full w-full" speed={level.speed} pitch={-0.12} />
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
