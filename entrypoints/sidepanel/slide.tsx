import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Pixels a second, the same away and back. */
const SPEED = 46;
const FADE = 22;
/** Run past the end by half the fade again, or the last words rest under it. */
const LEAD = Math.round(FADE * 1.5);

const EDGE = `linear-gradient(to right, #000 calc(100% - ${FADE}px), transparent)`;
const EDGES = `linear-gradient(to right, transparent, #000 ${FADE}px, #000 calc(100% - ${FADE}px), transparent)`;

export function Slide({
  text,
  reading,
  className,
}: {
  text: string;
  /** Pointer is on whatever holds this, so an overrunning line shows its end. */
  reading: boolean;
  className: string;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const line = useRef<HTMLSpanElement | null>(null);
  const [over, setOver] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!box.current || !line.current) return;
      setOver(Math.max(0, line.current.scrollWidth - box.current.clientWidth));
    };

    measure();
    // Fonts land after the first paint and change the measured width.
    void document.fonts?.ready.then(measure);
    const watch = new ResizeObserver(measure);
    if (box.current) watch.observe(box.current);
    return () => watch.disconnect();
  }, [text]);

  const away = reading && over > 0;
  const travel = over + LEAD;

  return (
    <div
      ref={box}
      className="overflow-hidden"
      style={over ? { maskImage: away ? EDGES : EDGE } : undefined}
    >
      <span
        ref={line}
        className={cn('block w-max whitespace-nowrap', className)}
        style={{
          transform: `translateX(${away ? -travel : 0}px)`,
          transition: `transform ${(travel / SPEED).toFixed(1)}s ease-out`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
