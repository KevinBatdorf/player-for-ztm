import { lazy } from 'react';

const Landscape = lazy(() => import('@/components/react-bits/landscape'));

export { Landscape };

/**
 * Kevin's settled values from the field lab. The geometry is identical across both,
 * so changing level never moves the horizon — only the palette and the opacity go.
 */
const GEOMETRY = {
  speed: 0.7,
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
  color: string;
  farColor: string;
  ringColor: string;
};

export const FULL: Level = {
  opacity: 1,
  color: '#2E1065',
  farColor: '#D946EF',
  ringColor: '#A855F7',
};

/** One colour across all three ramps, which is what takes the scene down to a texture. */
export const MUTED: Level = {
  opacity: 0.34,
  color: '#2E1065',
  farColor: '#2E1065',
  ringColor: '#2E1065',
};

export const OFF: Level = { ...MUTED, opacity: 0 };

export const landscapeProps = (level: Level) => ({
  ...GEOMETRY,
  color: level.color,
  farColor: level.farColor,
  ringColor: level.ringColor,
});
