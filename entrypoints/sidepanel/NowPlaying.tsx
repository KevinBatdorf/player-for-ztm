import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLibrary } from './library';
import type { Loaded } from '@/lib/machine';

const GAP = 44;
/** Pixels a second. */
const SPEED = 42;

export function NowPlaying({ lesson }: { lesson: Loaded }) {
  const { courses, lessonsFor } = useLibrary();
  const course = courses?.find((c) => c.id === lesson.courseId);
  const playing = lessonsFor(lesson.courseId).find((l) => l.id === lesson.lessonId);

  return (
    <div className="rule-t shrink-0 bg-canvas px-4 py-2">
      <p className="truncate font-mono text-caption text-ink-faint">
        {course?.title ?? lesson.courseId}
      </p>
      <Marquee text={playing?.title ?? lesson.lessonId} />
    </div>
  );
}

const LINE = 'text-body leading-snug whitespace-nowrap text-ink';

function Marquee({ text }: { text: string }) {
  const line = useRef<HTMLSpanElement | null>(null);
  const [span, setSpan] = useState(0);

  useEffect(() => {
    const measure = () => setSpan(line.current ? line.current.scrollWidth + GAP : 0);
    measure();
    // Fonts land after the first paint and change the measured width.
    void document.fonts?.ready.then(measure);
  }, [text]);

  const rolling = {
    gap: `${GAP}px`,
    '--marquee-span': `${span}px`,
    animation: span ? `panel-marquee ${(span / SPEED).toFixed(1)}s linear infinite` : undefined,
  } as CSSProperties;

  return (
    <div className="overflow-hidden">
      <div className="mt-0.5 flex w-max" style={rolling}>
        <span ref={line} className={LINE}>
          {text}
        </span>
        {/* A second copy, so the loop has no gap at the wrap. */}
        <span aria-hidden className={LINE}>
          {text}
        </span>
      </div>
    </div>
  );
}
