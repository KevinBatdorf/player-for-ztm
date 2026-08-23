import { useEffect, useRef } from 'react';
import { useFlair } from './settings';

/** Written straight to CSS vars: a pointermove that re-renders React drops frames. */
export function Spotlight() {
  const glow = useRef<HTMLDivElement>(null);
  const flair = useFlair();

  useEffect(() => {
    const node = glow.current;
    const host = node?.parentElement;
    if (!node || !host) return;

    const move = (event: PointerEvent) => {
      const box = host.getBoundingClientRect();
      node.style.setProperty('--x', `${event.clientX - box.left}px`);
      node.style.setProperty('--y', `${event.clientY - box.top}px`);
      node.style.opacity = '1';
    };

    const leave = () => {
      node.style.opacity = '0';
    };

    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);

    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
    };
  }, []);

  // Tracking the cursor is motion, so `none` removes it.
  if (flair === 'none') return null;

  return (
    <div
      ref={glow}
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-panel"
      style={{
        background:
          'radial-gradient(240px circle at var(--x, 50%) var(--y, 50%), var(--t-glow), transparent 72%)',
      }}
    />
  );
}
