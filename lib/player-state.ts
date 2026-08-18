export type PlayerTick = {
  at: number;
  instanceId: string;
  lesson: string;
  currentTime: number;
  duration: number | null;
  paused: boolean;
  rate: number;
  // Real watched coverage rather than furthest position, so a lesson can be
  // marked complete on what was actually seen.
  played: [number, number][];
  mediaSrc: string | null;
  manifests: string[];
};

export type SeekRequest = { t: number; at: number };

// `src` must be a manifest: an embed URL would replace the document and take
// Picture-in-Picture with it. `embed` is only for frames not built yet.
export type SwapRequest = {
  at: number;
  lesson: string;
  src: string;
  embed: string;
  duration: number | null;
};

export type SwapResult = { at: number; lesson: string; playing?: boolean; error?: string };

export const coverage = (tick: PlayerTick) =>
  tick.duration ? tick.played.reduce((sum, [a, b]) => sum + (b - a), 0) / tick.duration : 0;

export const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};
