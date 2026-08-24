import { useEffect, useRef, useState } from 'react';
import { useLibrary } from './library';
import { numberOf, titled } from '@/lib/lessons';
import { cn } from '@/lib/utils';
import type { Loaded } from '@/lib/machine';

/** Pixels a second, the same away and back. */
const SPEED = 46;
const FADE = 22;
/** Run past the end by half the fade again, or the last words rest under it. */
const LEAD = Math.round(FADE * 1.5);

const EDGE = `linear-gradient(to right, #000 calc(100% - ${FADE}px), transparent)`;
const EDGES = `linear-gradient(to right, transparent, #000 ${FADE}px, #000 calc(100% - ${FADE}px), transparent)`;

export function NowPlaying({ lesson }: { lesson: Loaded }) {
  const { courses, lessonsFor } = useLibrary();
  const [reading, setReading] = useState(false);
  const course = courses?.find((c) => c.id === lesson.courseId);
  const lessons = lessonsFor(lesson.courseId);
  const playing = lessons.find((l) => l.id === lesson.lessonId);

  return (
    // `relative`, or the dot field is positioned and paints over the whole bar.
    <div
      onPointerEnter={() => setReading(true)}
      onPointerLeave={() => setReading(false)}
      className="rule-t relative shrink-0 space-y-0.5 bg-canvas px-4 py-2 shadow-lift"
    >
      <Slide
        text={course?.title ?? lesson.courseId}
        reading={reading}
        className="font-mono text-caption text-ink-faint"
      />
      <Slide
        text={titled(numberOf(lessons, lesson.lessonId), playing?.title ?? lesson.lessonId)}
        reading={reading}
        className="text-body leading-snug text-ink"
      />
    </div>
  );
}

function Slide({
  text,
  reading,
  className,
}: {
  text: string;
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
