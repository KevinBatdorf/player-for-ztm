import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { useLibrary } from './library';
import { fixtureLessons } from '@/lib/fixtures';
import { FRAME_ORIGIN, framed, fromFrame, type ToFrame } from '@/lib/frame';
import { nextOf } from '@/lib/lessons';
import type { Action, LessonId, Loaded } from '@/lib/machine';
import { sign } from '@/lib/video';
import { isDone } from '@/lib/watched';

const NONE: never[] = [];

type Status =
  | { kind: 'empty' }
  | { kind: 'signing' }
  | { kind: 'loading' }
  | { kind: 'holding' }
  | { kind: 'playing' }
  | { kind: 'failed'; message: string };

/** Not a screen: Picture-in-Picture and the sticky activation die with the document. */
export function Player({
  lesson,
  dispatch,
}: {
  lesson: Loaded | null;
  dispatch: Dispatch<Action>;
}) {
  const { courses, lessonsFor, markWatched } = useLibrary();
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'empty' });
  const frame = useRef<HTMLIFrameElement | null>(null);
  // One document for the session; a lesson change is a swap, never a reload.
  const loaded = useRef<string | null>(null);
  const signedFor = useRef<LessonId | null>(null);
  const listening = useRef(false);
  const queued = useRef<ToFrame | null>(null);

  const send = useCallback((message: ToFrame) => {
    const inside = frame.current?.contentWindow;
    // Its script attaches well after the element exists, so an early swap waits for it.
    if (!listening.current || !inside) {
      queued.current = message;
      return;
    }
    queued.current = null;
    inside.postMessage(message, FRAME_ORIGIN);
  }, []);

  const course = courses?.find((c) => c.id === lesson?.courseId);
  const lessons = lesson
    ? courses
      ? lessonsFor(lesson.courseId)
      : fixtureLessons(lesson.courseId)
    : NONE;
  const playing = lessons.find((l) => l.id === lesson?.lessonId);
  const said = lesson ? note(status, course?.slug ?? null) : null;

  useEffect(() => {
    if (!lesson) {
      // Closing drops the document, and its activation and any popout with it.
      loaded.current = null;
      signedFor.current = null;
      listening.current = false;
      queued.current = null;
      setSource(null);
      setStatus({ kind: 'empty' });
      return;
    }

    if (signedFor.current === lesson.lessonId) return;
    // An onboarding tile has no course page, so there is nothing to sign against.
    if (!course?.slug) return;

    const { courseId, lessonId } = lesson;
    signedFor.current = lessonId;
    setStatus({ kind: 'signing' });

    sign({ courseId, slug: course.slug, lessonId })
      .then((signed) => {
        // A later pick beat this one home, so its manifest is for the wrong lesson.
        if (signedFor.current !== lessonId) return;
        setStatus({ kind: 'loading' });

        if (loaded.current) {
          send({ ztm: 'swap', lessonId, src: signed.src });
          return;
        }
        loaded.current = framed(signed.embed, lessonId);
        setSource(loaded.current);
      })
      .catch((cause: unknown) => {
        if (signedFor.current !== lessonId) return;
        // Cleared so picking the same lesson again is a retry rather than a no-op.
        signedFor.current = null;
        setStatus({
          kind: 'failed',
          message: cause instanceof Error ? cause.message : String(cause),
        });
      });
  }, [lesson, course?.slug, send]);

  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.origin !== FRAME_ORIGIN) return;
      const message = fromFrame(event.data);
      if (!message) return;

      switch (message.ztm) {
        case 'ready':
          listening.current = true;
          if (queued.current) return send(queued.current);
          // A swap reports `playing` before this, so it must not be read as a stop.
          return setStatus((was) => (was.kind === 'playing' ? was : { kind: 'holding' }));

        case 'playing':
          return setStatus({ kind: 'playing' });

        case 'progress':
          if (lesson && isDone(message.covered, message.duration)) {
            markWatched(lesson.courseId, message.lessonId);
          }
          return;

        case 'ended':
          if (!lesson) return;
          markWatched(lesson.courseId, message.lessonId);
          return dispatch({
            type: 'lessonEnded',
            nextLessonId: nextOf(lessons, message.lessonId)?.id ?? null,
          });

        case 'failed':
          return setStatus({ kind: 'failed', message: message.message });
      }
    };

    addEventListener('message', heard);
    return () => removeEventListener('message', heard);
  }, [dispatch, lesson, lessons, markWatched, send]);

  if (!lesson) {
    return (
      <Shell>
        <Frame>
          <Note>
            <p className="text-body text-ink" style={SCRIM}>
              Pick a course to start
            </p>
            <p className="mt-1 font-mono text-caption text-ink-soft" style={SCRIM}>
              the lesson plays up here and the list stays put
            </p>
          </Note>
        </Frame>
      </Shell>
    );
  }

  return (
    <Shell>
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

        {said && (
          <Note>
            <p className="pointer-events-none font-mono text-caption text-ink-soft" style={SCRIM}>
              {said}
            </p>
          </Note>
        )}
      </Frame>

      <div className="flex items-start gap-2 px-6 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-body leading-snug text-ink">{playing?.title ?? lesson.lessonId}</p>
          <p className="mt-0.5 text-caption text-ink-soft">{course?.title ?? lesson.courseId}</p>
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
    </Shell>
  );
}

/** Play and Pop out are the frame's own, so the panel only ever narrates. */
function note(status: Status, slug: string | null): string | null {
  if (!slug) return 'One of their onboarding tiles, so it has no lecture to sign.';

  switch (status.kind) {
    case 'signing':
      return 'signing…';
    case 'loading':
      return 'loading the video…';
    case 'failed':
      return status.message;
    default:
      return null;
  }
}

/** `relative` or it paints under the backdrop, which is absolute and earlier in the DOM. */
const Shell = ({ children }: { children: ReactNode }) => (
  <div className="relative shrink-0">{children}</div>
);

/** The dot grid runs under this type, so it needs its own ground to stay legible. */
const SCRIM = { textShadow: '0 1px 9px rgba(var(--t-scrim), 0.95)' };

/** No background of its own; the dot layer is what shows through. */
const Frame = ({ children }: { children: ReactNode }) => (
  <div className="relative aspect-video w-full">{children}</div>
);

const Note = ({ children }: { children: ReactNode }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
    {children}
  </div>
);
