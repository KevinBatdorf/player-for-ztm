import { lazy } from 'react';

const Landscape = lazy(() => import('@/components/react-bits/landscape'));

export { Landscape };

/** Settled in the field lab. Identical across levels, so the horizon never moves. */
const GEOMETRY = {
  altitude: 7.2,
  pitch: -0.2,
  elevation: 3.5,
  focal: 0.55,
  scale: 0.35,
  fogStart: 4,
  distance: 30,
} as const;

export type Level = {
  opacity: number;
  speed: number;
  /** The field runs under every screen, so the scrim travels with the level. */
  vignette: number;
  color: string;
  farColor: string;
  ringColor: string;
};

export const NORMAL: Level = {
  opacity: 1,
  speed: 0.45,
  vignette: 0.32,
  color: '#05070A',
  farColor: '#05070A',
  /** Their pink taken well down: at full strength the ridges blow out to white. */
  ringColor: '#590826',
};

/** One colour across all three ramps, which is what takes the scene down to a texture. */
export const MUTED: Level = {
  opacity: 0.34,
  speed: 0.05,
  vignette: 0.18,
  color: '#05070A',
  farColor: '#05070A',
  ringColor: '#120A10',
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

/** All six travel together; animating a subset makes the level change lurch. */
export const blend = (a: Level, b: Level, t: number): Level => ({
  opacity: mixNumber(a.opacity, b.opacity, t),
  speed: mixNumber(a.speed, b.speed, t),
  vignette: mixNumber(a.vignette, b.vignette, t),
  color: mixColor(a.color, b.color, t),
  farColor: mixColor(a.farColor, b.farColor, t),
  ringColor: mixColor(a.ringColor, b.ringColor, t),
});

export const landscapeProps = (level: Level) => ({
  ...GEOMETRY,
  speed: level.speed,
  color: level.color,
  farColor: level.farColor,
  ringColor: level.ringColor,
  opacity: level.opacity,
  // Defaults to true in the vendored component, and the camera then swings with the mouse.
  cursorInteraction: false,
});
