import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import { useLibrary } from './library';
import { FRAME_ORIGIN, framed, fromFrame, type ToFrame } from '@/lib/frame';
import { nextOf } from '@/lib/lessons';
import type { Action, LessonId, Loaded } from '@/lib/machine';
import { cn } from '@/lib/utils';
import { sign } from '@/lib/video';
import { isDone } from '@/lib/watched';

const NONE: never[] = [];

const DWELL_MS = 800;

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
  collapsed,
  onWaiting,
  dispatch,
}: {
  lesson: Loaded | null;
  /** The frame stays mounted and audible while the canvas is collapsed. */
  collapsed: boolean;
  /** The bar outside this component shows the same wait. */
  onWaiting: (waiting: boolean) => void;
  dispatch: Dispatch<Action>;
}) {
  const { courses, lessonsFor, markWatched } = useLibrary();
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'empty' });
  const [dwelling, setDwelling] = useState(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  // One document for the session; a lesson change is a swap, never a reload.
  const loaded = useRef<string | null>(null);
  const signedFor = useRef<LessonId | null>(null);
  const listening = useRef(false);
  const queued = useRef<ToFrame | null>(null);
  // What the frame is doing, which the panel cannot read off a cross-origin document.
  const rolling = useRef(false);
  const advancing = useRef(false);

  const send = useCallback((message: ToFrame) => {
    const inside = frame.current?.contentWindow;
    // Its script attaches well after the element exists, so an early swap waits for it.
    if (!listening.current || !inside) {
      // A frame that never played is already paused, so only a swap is queued.
      if (message.ztm === 'swap') queued.current = message;
      return;
    }
    queued.current = null;
    inside.postMessage(message, FRAME_ORIGIN);
  }, []);

  const course = courses?.find((c) => c.id === lesson?.courseId);
  const lessons = lesson ? lessonsFor(lesson.courseId) : NONE;
  const busy = status.kind === 'signing' || status.kind === 'loading';
  const fault = lesson ? faultIn(status, course?.slug ?? null) : null;

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
          // A pick inherits the last video's play state; the end of a lesson overrides it.
          const play = advancing.current || rolling.current;
          advancing.current = false;
          send({ ztm: 'swap', lessonId, src: signed.src, play });
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
    if (collapsed) send({ ztm: 'pause' });
  }, [collapsed, send]);

  // A warm swap resolves in a frame or two, and that reads as a flicker.
  useEffect(() => {
    if (!busy) return;
    setDwelling(true);
    const rest = setTimeout(() => setDwelling(false), DWELL_MS);
    return () => clearTimeout(rest);
  }, [busy]);

  const waiting = busy || dwelling;

  useEffect(() => onWaiting(waiting), [waiting, onWaiting]);

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
          rolling.current = true;
          return setStatus({ kind: 'playing' });

        case 'paused':
          rolling.current = false;
          return setStatus((was) => (was.kind === 'playing' ? { kind: 'holding' } : was));

        case 'progress':
          if (lesson && isDone(message.covered, message.duration)) {
            markWatched(lesson.courseId, message.lessonId);
          }
          return;

        case 'ended': {
          if (!lesson) return;
          markWatched(lesson.courseId, message.lessonId);
          const nextLessonId = nextOf(lessons, message.lessonId)?.id ?? null;
          // The viewer did not pick this one, so the play carries over.
          advancing.current = nextLessonId !== null;
          rolling.current = false;
          return dispatch({ type: 'lessonEnded', nextLessonId });
        }

        case 'failed':
          return setStatus({ kind: 'failed', message: message.message });
      }
    };

    addEventListener('message', heard);
    return () => removeEventListener('message', heard);
  }, [dispatch, lesson, lessons, markWatched, send]);

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
        color="#12151b"
        hotColor="#6c56a0"
        backgroundColor="#000000"
        bandWidth={0.22}
        warp={1}
        tilt={0.15}
        gain={1.45}
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

/** No background of its own; the dot layer is what shows through. */
const Frame = ({ children }: { children: ReactNode }) => (
  // `relative` or it paints under the backdrop, which is absolute and earlier in the DOM.
  <div className="relative aspect-video w-full">{children}</div>
);

const Note = ({ children }: { children: ReactNode }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
    {children}
  </div>
);
