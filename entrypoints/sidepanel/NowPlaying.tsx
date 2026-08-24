import { useEffect, useRef, useState } from 'react';
import { useLibrary } from './library';
import type { Loaded } from '@/lib/machine';

/** Pixels a second, away and back. */
const AWAY = 46;
const BACK = 20;
const FADE = 22;

const EDGE = `linear-gradient(to right, #000 calc(100% - ${FADE}px), transparent)`;
const EDGES = `linear-gradient(to right, transparent, #000 ${FADE}px, #000 calc(100% - ${FADE}px), transparent)`;

export function NowPlaying({ lesson }: { lesson: Loaded }) {
  const { courses, lessonsFor } = useLibrary();
  const [reading, setReading] = useState(false);
  const course = courses?.find((c) => c.id === lesson.courseId);
  const playing = lessonsFor(lesson.courseId).find((l) => l.id === lesson.lessonId);

  return (
    // `relative`, or the dot field is positioned and paints over the whole bar.
    <div
      onPointerEnter={() => setReading(true)}
      onPointerLeave={() => setReading(false)}
      className="rule-t relative shrink-0 bg-canvas px-4 py-2 shadow-lift"
    >
      <p className="truncate font-mono text-caption text-ink-faint">
        {course?.title ?? lesson.courseId}
      </p>
      <Slide text={playing?.title ?? lesson.lessonId} reading={reading} />
    </div>
  );
}

function Slide({ text, reading }: { text: string; reading: boolean }) {
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
  const seconds = over / (away ? AWAY : BACK);

  return (
    <div
      ref={box}
      className="mt-0.5 overflow-hidden"
      style={over ? { maskImage: away ? EDGES : EDGE } : undefined}
    >
      <span
        ref={line}
        className="block w-max text-body leading-snug whitespace-nowrap text-ink"
        style={{
          transform: `translateX(${away ? -over : 0}px)`,
          transition: `transform ${seconds.toFixed(1)}s ${away ? 'ease-out' : 'ease-in-out'}`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
