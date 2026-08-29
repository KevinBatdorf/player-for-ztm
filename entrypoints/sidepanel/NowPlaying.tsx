import { Maximize2 } from 'lucide-react';
import { useEffect, useState, type Dispatch, type ReactNode } from 'react';
import { browser } from '#imports';
import { useLibrary } from './library';
import { Slide } from './slide';
import { Button } from '@/components/ui/button';
import { numberOf, titled } from '@/lib/lessons';
import type { Action, Loaded } from '@/lib/machine';

const watchUrl = (lesson: Loaded) =>
  browser.runtime.getURL(
    `/watch.html?course=${encodeURIComponent(lesson.courseId)}&lesson=${encodeURIComponent(lesson.lessonId)}`,
  );

export function NowPlaying({
  lesson,
  waiting,
  dispatch,
}: {
  lesson: Loaded | null;
  waiting: boolean;
  dispatch: Dispatch<Action>;
}) {
  const { remember } = useLibrary();

  // Written from here because this renders for exactly as long as a lesson is loaded.
  useEffect(() => {
    if (lesson) remember(lesson.courseId, lesson.lessonId);
  }, [lesson, remember]);

  return lesson ? (
    <Playing lesson={lesson} waiting={waiting} dispatch={dispatch} />
  ) : (
    <PickUp dispatch={dispatch} />
  );
}

function Playing({
  lesson,
  waiting,
  dispatch,
}: {
  lesson: Loaded;
  waiting: boolean;
  dispatch: Dispatch<Action>;
}) {
  const { courses, lessonsFor } = useLibrary();
  const [reading, setReading] = useState(false);

  const course = courses?.find((c) => c.id === lesson.courseId);
  const lessons = lessonsFor(lesson.courseId);
  const current = lessons.find((l) => l.id === lesson.lessonId);

  const handOff = () => {
    void browser.tabs.create({ url: watchUrl(lesson) });
    dispatch({ type: 'lessonHandedOff' });
  };

  return (
    <Bar onReading={setReading}>
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1 space-y-0.5">
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

        {course?.slug && (
          <Button variant="silver" size="xs" className="shrink-0" onClick={handOff}>
            bigger
            <Maximize2 aria-hidden />
          </Button>
        )}
      </div>
    </Bar>
  );
}

/** Nothing is loaded, so the bar offers back whatever the last session was on. */
function PickUp({ dispatch }: { dispatch: Dispatch<Action> }) {
  const { courses, lessonsFor, lastPlayed } = useLibrary();
  const [reading, setReading] = useState(false);

  const course = courses?.find((c) => c.id === lastPlayed?.courseId);
  const lessons = lastPlayed ? lessonsFor(lastPlayed.courseId) : [];
  const lesson = lessons.find((l) => l.id === lastPlayed?.lessonId);
  // A lesson that left the catalogue, or was never a video, is not worth offering.
  if (!lastPlayed || !course || !lesson || lesson.video === false) return null;

  return (
    <Bar onReading={setReading}>
      <p className="font-mono text-caption text-ink-faint">pick up where you left off</p>

      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <Slide
            text={titled(numberOf(lessons, lesson.id), lesson.title)}
            reading={reading}
            className="text-body leading-snug text-ink"
          />
          <Slide
            text={course.title}
            reading={reading}
            className="font-mono text-caption text-ink-faint"
          />
        </div>

        <Button
          variant="silver"
          size="xs"
          className="shrink-0"
          onClick={() =>
            dispatch({
              type: 'lessonPlayed',
              courseId: lastPlayed.courseId,
              lessonId: lastPlayed.lessonId,
            })
          }
        >
          play
        </Button>
      </div>
    </Bar>
  );
}

const Bar = ({
  children,
  onReading,
}: {
  children: ReactNode;
  onReading: (reading: boolean) => void;
}) => (
  // `relative`, or the dot field is positioned and paints over the whole bar.
  <div
    onPointerEnter={() => onReading(true)}
    onPointerLeave={() => onReading(false)}
    className="rule-t relative shrink-0 space-y-0.5 bg-canvas px-4 py-2 shadow-lift"
  >
    {children}
  </div>
);
