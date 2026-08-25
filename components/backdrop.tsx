import { lazy } from 'react';
import { ZTM_GREEN } from '@/lib/brand';

const Squares = lazy(() => import('@/components/react-bits/squares-terminal'));

export { Squares };

/** Settled in the field lab. Identical across levels, so the grid never resizes. */
const GRID = {
  columns: 96,
  rows: 96,
  backgroundColor: '#0a0b0d',
  rowBias: 0.2,
  curvature: 0.12,
  // Defaults to true in the vendored component, and rows then lift under the mouse.
  cursorInteraction: false,
} as const;

export type Level = {
  opacity: number;
  speed: number;
  /** The field runs under every screen, so the scrim travels with the level. */
  vignette: number;
  glow: number;
  color: string;
};

export const NORMAL: Level = {
  opacity: 0.9,
  speed: 9,
  vignette: 0.42,
  glow: 0.55,
  color: ZTM_GREEN,
};

/** Dimmer and slower, which is what takes the field down to a texture. */
export const MUTED: Level = {
  opacity: 0.34,
  speed: 5,
  vignette: 0.55,
  glow: 0.25,
  color: ZTM_GREEN,
};

const channels = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const hex = (rgb: [number, number, number]) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

const mixNumber = (a: number, b: number, t: number) => a + (b - a) * t;

const mixColor = (a: string, b: string, t: number) => {
  const from = channels(a);
  const to = channels(b);
  return hex([
    mixNumber(from[0]!, to[0]!, t),
    mixNumber(from[1]!, to[1]!, t),
    mixNumber(from[2]!, to[2]!, t),
  ]);
};

/** All five travel together; animating a subset makes the level change lurch. */
export const blend = (a: Level, b: Level, t: number): Level => ({
  opacity: mixNumber(a.opacity, b.opacity, t),
  speed: mixNumber(a.speed, b.speed, t),
  vignette: mixNumber(a.vignette, b.vignette, t),
  glow: mixNumber(a.glow, b.glow, t),
  color: mixColor(a.color, b.color, t),
});

export const squaresProps = (level: Level) => ({
  ...GRID,
  speed: level.speed,
  color: level.color,
  glow: level.glow,
  vignette: level.vignette,
  opacity: level.opacity,
});
