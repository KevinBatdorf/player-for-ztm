import { Suspense, useEffect, useRef, useState } from 'react';
import { blend, Landscape, landscapeProps, MUTED, NORMAL } from '@/components/backdrop';
import type { BackdropLevel } from '@/lib/machine';

/** Landscape reports no first frame of its own, so the mark comes up on this. */
const READY_DEADLINE_MS = 900;

/** Only one level change happens per session. */
const RAMP_MS = 700;

/**
 * One instance for the app's life. Per-screen mounting cost a WebGL init on every
 * transition, and on `boot` that init was the two seconds of black.
 */
export function Backdrop({ level, onReady }: { level: BackdropLevel; onReady: () => void }) {
  const [drawn, setDrawn] = useState(false);
  const t = useRamp(level === 'muted' ? 1 : 0);
  const field = blend(NORMAL, MUTED, t);

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
        {/* Reveal only; the level's own opacity is a shader uniform. */}
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-panel"
          style={{ opacity: drawn ? 1 : 0 }}
        >
          {/* Its root sets no size, so without this the fiber canvas falls back to 300x150. */}
          <Landscape className="h-full w-full" {...landscapeProps(field)} />
        </div>

        {/* The scene moves, so the mark's contrast cannot depend on what is under it. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              'radial-gradient(104% 68% at 50% 47%,',
              `rgba(var(--t-scrim), ${field.vignette}) 0%,`,
              `rgba(var(--t-scrim), ${field.vignette * 0.7}) 34%,`,
              `rgba(var(--t-scrim), ${field.vignette * 0.28}) 62%,`,
              'rgba(var(--t-scrim), 0) 88%)',
            ].join(' '),
          }}
        />
      </Suspense>
    </div>
  );
}

/** Smoothstep rather than a bezier solver; the shader eases everything else this way. */
const smooth = (p: number) => p * p * (3 - 2 * p);

/** In JS, not CSS: three of the four properties are shader uniforms. */
function useRamp(target: number): number {
  const [t, setT] = useState(target);
  const at = useRef(target);
  at.current = t;

  useEffect(() => {
    const from = at.current;
    if (from === target) return;

    let frame = 0;
    const started = performance.now();

    const step = (now: number) => {
      const p = Math.min(1, (now - started) / RAMP_MS);
      setT(from + (target - from) * smooth(p));
      if (p < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return t;
}
