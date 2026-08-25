import { useEffect, useState } from 'react';
import { useLibrary } from './library';
import { Slide } from './slide';
import { numberOf, titled } from '@/lib/lessons';
import type { Loaded } from '@/lib/machine';

export function NowPlaying({ lesson, waiting }: { lesson: Loaded; waiting: boolean }) {
  const { courses, lessonsFor, remember } = useLibrary();
  const [reading, setReading] = useState(false);
  const course = courses?.find((c) => c.id === lesson.courseId);
  const lessons = lessonsFor(lesson.courseId);
  const current = lessons.find((l) => l.id === lesson.lessonId);

  // Written from here because this renders for exactly as long as a lesson is loaded.
  useEffect(() => {
    remember(lesson.courseId, lesson.lessonId);
  }, [lesson.courseId, lesson.lessonId, remember]);

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
        text={
          waiting
            ? 'Loading…'
            : titled(numberOf(lessons, lesson.lessonId), current?.title ?? lesson.lessonId)
        }
        reading={reading}
        className="text-body leading-snug text-ink"
      />
    </div>
  );
}
