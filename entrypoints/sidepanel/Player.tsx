import type { Dispatch, ReactNode } from 'react';
import { useLibrary } from './library';
import { fixtureLessons } from '@/lib/fixtures';
import { nextOf } from '@/lib/lessons';
import type { Action, Loaded } from '@/lib/machine';

/** Not a screen: PiP and the sticky activation die with the document owning the video. */
export function Player({
  lesson,
  dispatch,
}: {
  lesson: Loaded | null;
  dispatch: Dispatch<Action>;
}) {
  const { courses, lessonsFor } = useLibrary();

  if (!lesson) {
    return (
      <Shell>
        <Frame>
          <p className="text-body text-ink-soft">Pick a course to start</p>
          <p className="mt-1 font-mono text-caption text-ink-faint">
            the lesson plays up here and the list stays put
          </p>
        </Frame>
      </Shell>
    );
  }

  const course = courses?.find((c) => c.id === lesson.courseId);
  const lessons = courses ? lessonsFor(lesson.courseId) : fixtureLessons(lesson.courseId);
  const playing = lessons.find((l) => l.id === lesson.lessonId);
  const next = nextOf(lessons, lesson.lessonId);

  return (
    <Shell>
      <Frame>
        <span className="font-mono text-caption text-ink-faint">player frame</span>
      </Frame>

      <div className="flex items-start gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-body leading-snug text-ink">{playing?.title ?? lesson.lessonId}</p>
          <p className="mt-0.5 text-caption text-ink-soft">
            {course?.title ?? lesson.courseId}
          </p>
        </div>

        <button
          type="button"
          onClick={() => dispatch({ type: 'playerClosed' })}
          aria-label="Close the player"
          className="rule shrink-0 rounded-panel px-1.5 py-0.5 font-mono text-caption text-ink-faint transition-colors duration-150 ease-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ✕
        </button>
      </div>

      {/* No real player yet, so nothing fires `ended`. */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-line px-3 py-2">
        <span className="w-full font-mono text-caption text-ink-faint">simulate</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'lessonEnded', nextLessonId: next?.id ?? null })}
          className="rule rounded-panel bg-accent px-2.5 py-1 text-caption text-accent-ink shadow-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {next ? `ended → ${next.title}` : 'ended → end of course'}
        </button>
      </div>
    </Shell>
  );
}

/** `relative` or it paints under the backdrop, which is absolute and earlier in the DOM. */
const Shell = ({ children }: { children: ReactNode }) => (
  <div className="relative shrink-0">{children}</div>
);

/** No background of its own; the dot layer is what shows through. */
const Frame = ({ children }: { children: ReactNode }) => (
  <div className="flex aspect-video flex-col items-center justify-center px-4 text-center">
    {children}
  </div>
);
