import { useEffect, type Dispatch } from 'react';
import { useLibrary } from '../library';
import { useReader } from '../Reader';
import { Row, Screen, TextRow } from '../Screen';
import { titled } from '@/lib/lessons';
import type { Action, Loaded, ViewOf } from '@/lib/machine';

export function Course({
  view,
  lesson,
  queued,
  dispatch,
}: {
  view: ViewOf<'course'> | ViewOf<'courseLoading'>;
  lesson: Loaded | null;
  queued: Loaded | null;
  dispatch: Dispatch<Action>;
}) {
  const { courses, lessonsFor, openCourse, sweepText, seen } = useLibrary();
  const reader = useReader();

  const course = courses?.find((c) => c.id === view.courseId);
  const lessons = lessonsFor(view.courseId);
  const pending = view.name === 'courseLoading';

  // Titles are already in hand from the catalogue; this fetch is only durations and type.
  useEffect(() => {
    if (!pending) return;
    let live = true;

    void openCourse(view.courseId).then(() => {
      if (live) dispatch({ type: 'courseReady', courseId: view.courseId });
    });

    return () => {
      live = false;
    };
  }, [dispatch, openCourse, view.courseId, pending]);

  useEffect(() => {
    if (courses) sweepText(view.courseId);
  }, [courses, sweepText, view.courseId]);

  return (
    <>
      <Screen title={course?.title ?? view.courseId} onBack={() => dispatch({ type: 'wentHome' })}>
        {lessons.length === 0 ? (
          <p className="text-body text-ink-soft">
            {course && !course.slug
              ? 'This one is a welcome card, not a course, so there is nothing to play.'
              : 'No lessons here.'}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lessons.map((row, at) =>
              row.video === false ? (
                <TextRow
                  key={row.id}
                  title={titled(at + 1, row.title)}
                  done={seen(view.courseId, row.id)}
                  onRead={() => reader.open(view.courseId, row.id, row.title)}
                  onOpenTab={() => reader.openTab(view.courseId, row.id)}
                />
              ) : (
                <Row
                  key={row.id}
                  title={titled(at + 1, row.title)}
                  meta={row.duration ?? undefined}
                  active={lesson?.courseId === view.courseId && lesson.lessonId === row.id}
                  done={seen(view.courseId, row.id)}
                  queued={queued?.courseId === view.courseId && queued.lessonId === row.id}
                  canQueue={lesson !== null}
                  onClick={() =>
                    dispatch({ type: 'lessonPicked', courseId: view.courseId, lessonId: row.id })
                  }
                  onPlay={() =>
                    dispatch({ type: 'lessonPlayed', courseId: view.courseId, lessonId: row.id })
                  }
                  onQueue={() =>
                    dispatch({ type: 'lessonQueued', courseId: view.courseId, lessonId: row.id })
                  }
                />
              ),
            )}
          </div>
        )}

        {pending && (
          <p className="text-caption leading-relaxed text-ink-faint">
            Loading the rest of the lessons…
          </p>
        )}
      </Screen>

      {reader.node}
    </>
  );
}
