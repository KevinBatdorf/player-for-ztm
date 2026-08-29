import { useCallback, useEffect, useRef, useState } from 'react';
import { FRAME_ORIGIN, framed, fromFrame, type ToFrame } from '@/lib/frame';
import { nextOf, type Lesson } from '@/lib/lessons';
import type { CourseId, LessonId } from '@/lib/machine';
import { sign } from '@/lib/video';
import { isDone } from '@/lib/watched';

/** A warm swap resolves in a frame or two, and that reads as a flicker. */
const DWELL_MS = 800;

export type Status =
  | { kind: 'empty' }
  | { kind: 'signing' }
  | { kind: 'loading' }
  | { kind: 'holding' }
  | { kind: 'playing' }
  | { kind: 'failed'; message: string };

export type Held = { courseId: CourseId; lessonId: LessonId };

export type FramePlayer = {
  /** Belongs on the iframe element the hook posts into. */
  frame: React.RefObject<HTMLIFrameElement | null>;
  source: string | null;
  status: Status;
  waiting: boolean;
};

export function useFramePlayer({
  lesson,
  slug,
  lessons,
  insist,
  pause,
  queued,
  onWatched,
  onEnded,
  onBigger,
}: {
  lesson: Held | null;
  /** An onboarding tile has no course page, so there is nothing to sign against. */
  slug: string | null;
  lessons: Lesson[];
  /** Rises when a play was asked for rather than a lesson merely picked. */
  insist: number;
  /** Pauses without unmounting, so the frame keeps its activation. */
  pause: boolean;
  /** A lesson waiting its turn, so an ending one carries the play over regardless. */
  queued: boolean;
  onWatched: (courseId: CourseId, lessonId: LessonId) => void;
  onEnded: (nextLessonId: LessonId | null) => void;
  /** Its presence is what puts the button in the frame. */
  onBigger?: (lessonId: LessonId) => void;
}): FramePlayer {
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'empty' });
  const [dwelling, setDwelling] = useState(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  // One document for the session; a lesson change is a swap, never a reload.
  const loaded = useRef<string | null>(null);
  const signedFor = useRef<LessonId | null>(null);
  const listening = useRef(false);
  const held = useRef<ToFrame | null>(null);
  // What the frame is doing, which neither document can read off a cross-origin one.
  const rolling = useRef(false);
  const advancing = useRef(false);

  const send = useCallback((message: ToFrame) => {
    const inside = frame.current?.contentWindow;
    // Its script attaches well after the element exists, so an early swap waits for it.
    if (!listening.current || !inside) {
      // A frame that never played is already paused, so only a swap is queued.
      if (message.ztm === 'swap') held.current = message;
      return;
    }
    held.current = null;
    inside.postMessage(message, FRAME_ORIGIN);
  }, []);

  const busy = status.kind === 'signing' || status.kind === 'loading';

  useEffect(() => {
    if (!lesson) {
      // Closing drops the document, and its activation and any popout with it.
      loaded.current = null;
      signedFor.current = null;
      listening.current = false;
      held.current = null;
      setSource(null);
      setStatus({ kind: 'empty' });
      return;
    }

    if (signedFor.current === lesson.lessonId) return;
    if (!slug) return;

    const { courseId, lessonId } = lesson;
    signedFor.current = lessonId;
    setStatus({ kind: 'signing' });

    sign({ courseId, slug, lessonId })
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
        loaded.current = framed(signed.embed, lessonId, !!onBigger);
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
  }, [lesson, slug, onBigger, send]);

  useEffect(() => {
    if (pause) send({ ztm: 'pause' });
  }, [pause, send]);

  useEffect(() => {
    if (!busy) return;
    setDwelling(true);
    const rest = setTimeout(() => setDwelling(false), DWELL_MS);
    return () => clearTimeout(rest);
  }, [busy]);

  // The outgoing lesson would otherwise keep playing for the whole signing round trip.
  useEffect(() => {
    if (insist === 0) return;
    advancing.current = true;
    send({ ztm: 'pause' });
  }, [insist, send]);

  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.origin !== FRAME_ORIGIN) return;
      const message = fromFrame(event.data);
      if (!message) return;

      switch (message.ztm) {
        case 'ready':
          listening.current = true;
          if (held.current) return send(held.current);
          // A cold frame never swaps, so an insisted play has to be handed to it here.
          if (advancing.current) {
            advancing.current = false;
            send({ ztm: 'play' });
          }
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
            onWatched(lesson.courseId, message.lessonId);
          }
          return;

        case 'ended': {
          if (!lesson) return;
          onWatched(lesson.courseId, message.lessonId);
          const nextLessonId = nextOf(lessons, message.lessonId)?.id ?? null;
          // The viewer did not pick this one, so the play carries over.
          advancing.current = nextLessonId !== null || queued;
          rolling.current = false;
          return onEnded(nextLessonId);
        }

        case 'bigger':
          return onBigger?.(message.lessonId);

        case 'failed':
          return setStatus({ kind: 'failed', message: message.message });
      }
    };

    addEventListener('message', heard);
    return () => removeEventListener('message', heard);
  }, [lesson, lessons, onBigger, onEnded, onWatched, queued, send]);

  return { frame, source, status, waiting: busy || dwelling };
}
