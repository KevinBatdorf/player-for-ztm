import { Check, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { browser } from '#imports';
import { Button } from '@/components/ui/button';
import type { Course } from '@/lib/courses';
import { numberOf, titled, type Lesson, type LessonIndex } from '@/lib/lessons';
import type { CourseId, LessonId } from '@/lib/machine';
import { useFramePlayer, type Held } from '@/lib/player';
import { KEYS, read, write } from '@/lib/store';
import { cn } from '@/lib/utils';
import { mark, type Watched } from '@/lib/watched';

/** The panel puts both ids on the URL; there is no other way in. */
const asked = new URLSearchParams(location.search);
const COURSE_ID: CourseId = asked.get('course') ?? '';
const FIRST: LessonId = asked.get('lesson') ?? '';

const NONE: Lesson[] = [];

export function Watch() {
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>(NONE);
  const [watched, setWatched] = useState<Record<LessonId, number>>({});
  // An empty cache and a slow one look alike until this flips.
  const [ready, setReady] = useState(false);
  const [lesson, setLesson] = useState<Held | null>(
    COURSE_ID && FIRST ? { courseId: COURSE_ID, lessonId: FIRST } : null,
  );
  const [insist, setInsist] = useState(0);

  // Refetching here would start the ten-second enrolled walk in a second document.
  useEffect(() => {
    let live = true;

    void (async () => {
      const [courses, index, seen] = await Promise.all([
        read<Course[]>(KEYS.courses),
        read<LessonIndex>(KEYS.lessons),
        read<Watched>(KEYS.watched),
      ]);
      if (!live) return;

      setCourse(courses?.find((c) => c.id === COURSE_ID) ?? null);
      setLessons(index?.[COURSE_ID]?.lessons ?? NONE);
      setWatched(seen?.[COURSE_ID] ?? {});
      setReady(true);
    })();

    return () => {
      live = false;
    };
  }, []);

  const onWatched = useCallback((courseId: CourseId, lessonId: LessonId) => {
    void (async () => {
      // The store is written whole, so the panel's copy has to be re-read before merging.
      const held = (await read<Watched>(KEYS.watched)) ?? {};
      if (held[courseId]?.[lessonId]) return;

      const next = mark(held, courseId, lessonId);
      await write(KEYS.watched, next);
      setWatched(next[courseId] ?? {});
    })();
  }, []);

  const onEnded = useCallback((nextLessonId: LessonId | null) => {
    if (nextLessonId) setLesson((was) => (was ? { ...was, lessonId: nextLessonId } : was));
  }, []);

  const { frame, source, status, waiting } = useFramePlayer({
    lesson,
    slug: course?.slug ?? null,
    lessons,
    insist,
    pause: false,
    queued: false,
    onWatched,
    onEnded,
  });

  // Or the panel keeps offering the lesson this tab has already moved past.
  useEffect(() => {
    if (lesson) void write(KEYS.last, lesson);
  }, [lesson]);

  const current = lessons.find((l) => l.id === lesson?.lessonId);
  const heading = current ? titled(numberOf(lessons, current.id), current.title) : null;

  useEffect(() => {
    document.title = heading ? `${heading} — Player for ZTM` : 'Player for ZTM';
  }, [heading]);

  const close = () =>
    void browser.tabs.getCurrent().then((tab) => {
      if (tab?.id !== undefined) void browser.tabs.remove(tab.id);
    });

  return (
    <div className="flex h-screen flex-col bg-paper font-sans text-body text-ink">
      <header className="rule-b flex shrink-0 items-center gap-4 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-caption text-ink-faint">
            {course?.title ?? (ready ? 'Unknown course' : '')}
          </p>
          <h1 className="truncate text-heading leading-snug font-medium text-ink">
            {heading ?? (waiting ? 'Loading…' : 'Nothing loaded')}
          </h1>
        </div>

        <Button variant="silver" size="xs" className="shrink-0" onClick={close}>
          close
          <X aria-hidden />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas p-4">
          {/* Without max-h-full a wide window makes the video taller than its pane. */}
          <div className="relative aspect-video max-h-full w-full overflow-hidden rounded-panel bg-black">
            {source && (
              <iframe
                ref={frame}
                src={source}
                title="Lesson"
                allow="autoplay; fullscreen; picture-in-picture"
                className="absolute inset-0 h-full w-full border-0"
              />
            )}

            {fault(ready, course, status.kind === 'failed' ? status.message : null) && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <p className="font-mono text-caption text-ink-soft">
                  {fault(ready, course, status.kind === 'failed' ? status.message : null)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="h-[var(--t-line-w)] w-full shrink-0 bg-line lg:h-full lg:w-[var(--t-line-w)]" />

        <div className="flex min-h-0 shrink-0 basis-64 flex-col overflow-y-auto lg:w-80 lg:basis-auto">
          {lessons.map((row) => (
            <Row
              key={row.id}
              lesson={row}
              number={numberOf(lessons, row.id)}
              playing={row.id === lesson?.lessonId}
              done={!!watched[row.id]}
              onPick={() => {
                setLesson({ courseId: COURSE_ID, lessonId: row.id });
                setInsist((n) => n + 1);
              }}
            />
          ))}

          {ready && !lessons.length && (
            <p className="px-4 py-3 font-mono text-caption text-ink-faint">
              Open this course in the panel first; its lessons are not indexed yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function fault(ready: boolean, course: Course | null, message: string | null): string | null {
  if (!ready) return null;
  if (!course) return 'That course is not in the cache. Open the panel and try again.';
  if (!course.slug) return 'There’s no video in this one.';
  return message;
}

function Row({
  lesson,
  number,
  playing,
  done,
  onPick,
}: {
  lesson: Lesson;
  number: number | null;
  playing: boolean;
  done: boolean;
  onPick: () => void;
}) {
  // Text lessons have no video to sign; the reader for them is in the panel.
  const dead = lesson.video === false;

  return (
    <button
      type="button"
      disabled={dead}
      onClick={onPick}
      className={cn(
        'rule-b flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors duration-150 ease-panel',
        dead ? 'cursor-default opacity-40' : 'hover:bg-card-hover',
        playing && 'bg-card',
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-body leading-snug',
          playing ? 'font-medium text-playing' : 'text-ink',
        )}
      >
        {titled(number, lesson.title)}
      </span>

      {done && <Check className="size-3 shrink-0 text-accent-text" aria-label="Watched" />}
      {lesson.duration && (
        <span className="shrink-0 font-mono text-caption text-ink-faint">{lesson.duration}</span>
      )}
    </button>
  );
}
