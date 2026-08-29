import { lazy, Suspense, useCallback, useEffect, type Dispatch, type ReactNode } from 'react';
import { browser } from '#imports';
import { useLibrary } from './library';
import type { Action, LessonId, Loaded } from '@/lib/machine';
import { useFramePlayer, type Status } from '@/lib/player';
import { cn } from '@/lib/utils';

const NONE: never[] = [];

const watchUrl = (lesson: Loaded) =>
  browser.runtime.getURL(
    `/watch.html?course=${encodeURIComponent(lesson.courseId)}&lesson=${encodeURIComponent(lesson.lessonId)}`,
  );

/** Not a screen: Picture-in-Picture and the sticky activation die with the document. */
export function Player({
  lesson,
  queuedLesson,
  insist,
  collapsed,
  onWaiting,
  dispatch,
}: {
  lesson: Loaded | null;
  /** Only to know whether an ending lesson has somewhere to go. */
  queuedLesson: Loaded | null;
  /** Rises when a play was asked for rather than a lesson merely picked. */
  insist: number;
  /** The frame stays mounted and audible while the canvas is collapsed. */
  collapsed: boolean;
  /** The bar outside this component shows the same wait. */
  onWaiting: (waiting: boolean) => void;
  dispatch: Dispatch<Action>;
}) {
  const { courses, lessonsFor, markWatched } = useLibrary();

  const course = courses?.find((c) => c.id === lesson?.courseId);
  const lessons = lesson ? lessonsFor(lesson.courseId) : NONE;

  const onEnded = useCallback(
    (nextLessonId: LessonId | null) => dispatch({ type: 'lessonEnded', nextLessonId }),
    [dispatch],
  );

  const onBigger = useCallback(() => {
    if (!lesson) return;
    void browser.tabs.create({ url: watchUrl(lesson) });
    dispatch({ type: 'lessonHandedOff' });
  }, [lesson, dispatch]);

  const { frame, source, status, waiting } = useFramePlayer({
    lesson,
    slug: course?.slug ?? null,
    lessons,
    insist,
    pause: collapsed,
    queued: queuedLesson !== null,
    onWatched: markWatched,
    onEnded,
    onBigger,
  });

  useEffect(() => onWaiting(waiting), [waiting, onWaiting]);

  const fault = lesson ? faultIn(status, course?.slug ?? null) : null;

  if (!lesson) {
    return (
      <Frame>
        <Note>
          <p className="text-body text-ink" style={SCRIM}>
            Pick a lesson to start
          </p>
        </Note>
      </Frame>
    );
  }

  return (
    <Frame>
      {source && (
        <iframe
          ref={frame}
          src={source}
          title="Lesson"
          // Theirs ships this without picture-in-picture, which is why PiP is denied there.
          allow="autoplay; fullscreen; picture-in-picture"
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      {/* Mounted for the session: a fresh WebGL context takes a frame or two to draw. */}
      <Waiting show={waiting} />

      {fault && (
        <Note>
          <p className="pointer-events-none font-mono text-caption text-ink-soft" style={SCRIM}>
            {fault}
          </p>
        </Note>
      )}
    </Frame>
  );
}

function faultIn(status: Status, slug: string | null): string | null {
  if (!slug) return 'There’s no video in this one.';
  return status.kind === 'failed' ? status.message : null;
}

const Blinds = lazy(() => import('@/components/react-bits/rolling-blinds'));

/** Opaque, or the lesson being swapped away from sits there looking like a fault. */
const Waiting = ({ show }: { show: boolean }) => (
  <div
    className={cn(
      'pointer-events-none absolute inset-0 bg-canvas transition-opacity ease-panel',
      show ? 'opacity-100 duration-100' : 'opacity-0 duration-300',
    )}
  >
    <Suspense fallback={null}>
      <Blinds
        // Its root carries no size of its own, and a canvas with no height draws nothing.
        className="h-full w-full"
        color="#0d1014"
        hotColor="#5a626e"
        backgroundColor="#000000"
        bandWidth={0.22}
        warp={1}
        tilt={0.15}
        gain={1.15}
        contrast={1}
        vignette={0.1}
        drift={0.6}
        cursorInteraction={false}
      />
    </Suspense>
  </div>
);

/** The dot grid runs under this type, so it needs its own ground to stay legible. */
const SCRIM = { textShadow: '0 1px 9px rgba(var(--t-scrim), 0.95)' };

/** A transparent picture shows the field through wherever it does not reach. */
const Frame = ({ children }: { children: ReactNode }) => (
  // `relative` or it paints under the backdrop, which is absolute and earlier in the DOM.
  <div className="relative w-full p-1">
    <div className="relative aspect-video w-full overflow-hidden rounded-[6px] bg-canvas">
      {children}
    </div>
  </div>
);

const Note = ({ children }: { children: ReactNode }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
    {children}
  </div>
);
