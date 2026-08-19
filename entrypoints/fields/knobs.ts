import type { FieldId } from '@/lib/dev';

export type Knob =
  | { key: string; kind: 'range'; min: number; max: number; step: number; value: number }
  | { key: string; kind: 'color'; value: string }
  | { key: string; kind: 'bool'; value: boolean };

const range = (key: string, min: number, max: number, step: number, value: number): Knob => ({
  key,
  kind: 'range',
  min,
  max,
  step,
  value,
});

const color = (key: string, value: string): Knob => ({ key, kind: 'color', value });
const bool = (key: string, value: boolean): Knob => ({ key, kind: 'bool', value });

/**
 * Ranges bracket the plausible answer on both sides, so a slider can show that the
 * current value is wrong rather than only that it is adjustable.
 */
export const KNOBS: Record<FieldId, Knob[]> = {
  snow: [
    range('density', 0, 1, 0.01, 0.95),
    range('speed', 0, 3, 0.05, 0.7),
    range('brightness', 0, 3, 0.05, 1.5),
    range('flakeSize', 0.002, 0.06, 0.001, 0.01),
    range('minFlakeSize', 0.25, 4, 0.05, 1.25),
    range('pixelResolution', 40, 400, 5, 120),
    range('direction', 0, 360, 1, 165),
    range('depthFade', 0, 20, 0.5, 8),
    color('color', '#32DD88'),
  ],
  glitch: [
    range('glitchSpeed', 10, 400, 5, 45),
    color('glitchColor1', '#32DD88'),
    color('glitchColor2', '#F51767'),
    color('glitchColor3', '#4C0FFB'),
    bool('centerVignette', true),
    bool('outerVignette', false),
    bool('smooth', true),
  ],
  warp: [
    range('speed', 0, 3, 0.05, 0.7),
    range('density', 0, 20, 0.2, 8),
    range('brightness', 0, 3, 0.05, 1.5),
    range('starSize', 0.2, 12, 0.1, 3),
    range('focalDepth', 0.2, 6, 0.1, 1),
    range('turbulence', 0, 3, 0.05, 1),
    color('color', '#32DD88'),
  ],
  // Defaults are the settled values, so the lab opens on what shipped.
  landscape: [
    range('speed', 0, 3, 0.05, 0.7),
    range('altitude', 0.5, 20, 0.1, 7.2),
    range('pitch', -1, 1, 0.01, -0.2),
    range('elevation', 0, 12, 0.1, 3.5),
    range('focal', 0.4, 3, 0.05, 0.55),
    range('scale', 0.02, 0.6, 0.01, 0.35),
    range('fogStart', 4, 60, 1, 4),
    range('distance', 10, 90, 1, 30),
    color('color', '#2E1065'),
    color('farColor', '#D946EF'),
    color('ringColor', '#A855F7'),
  ],
  rays: [
    // The fan's spread was a hardcoded GLSL constant until it became a prop.
    range('topWidth', 0.05, 2.5, 0.05, 1.2),
    range('bottomWidth', 0.1, 4, 0.05, 1.6),
    range('rayCount', 4, 140, 1, 48),
    range('rayWidth', 0.001, 0.08, 0.001, 0.02),
    range('pulseSpeed', 0, 3, 0.05, 0.7),
    range('pulseWidth', 0.005, 0.25, 0.005, 0.03),
    range('trailLength', 0, 2, 0.05, 0.5),
    range('motionBlur', 0, 1, 0.02, 0.3),
    range('bgGlow', 0, 3, 0.05, 1.2),
    color('color1', '#32DD88'),
    color('color2', '#F51767'),
  ],
};

export type Values = Record<string, number | string | boolean>;

export const defaults = (field: FieldId): Values =>
  Object.fromEntries(KNOBS[field].map((k) => [k.key, k.value]));

/** Pasteable as JSX props, which is what survives the lab being deleted. */
export const asProps = (values: Values): string =>
  Object.entries(values)
    .map(([k, v]) => (typeof v === 'string' ? `${k}="${v}"` : `${k}={${v}}`))
    .join('\n');
