import { useEffect, type Dispatch } from 'react';
import { useLibrary } from '../library';
import { useReader } from '../Reader';
import { Row, Screen, StubNote, TextRow } from '../Screen';
import { fixtureLessons } from '@/lib/fixtures';
import type { Action, Loaded, ViewOf } from '@/lib/machine';

export function Course({
  view,
  lesson,
  dispatch,
}: {
  view: ViewOf<'course'>;
  lesson: Loaded | null;
  dispatch: Dispatch<Action>;
}) {
  const { courses, lessonsFor, sweepText } = useLibrary();
  const reader = useReader();

  const course = courses?.find((c) => c.id === view.courseId);
  // The dev panel can jump straight here, so the stubs stay reachable without a session.
  const lessons = courses ? lessonsFor(view.courseId) : fixtureLessons(view.courseId);

  useEffect(() => {
    if (courses) sweepText(view.courseId);
  }, [courses, sweepText, view.courseId]);

  return (
    <>
      <Screen title={course?.title ?? view.courseId} onBack={() => dispatch({ type: 'wentHome' })}>
        {lessons.length === 0 ? (
          <p className="text-body text-ink-soft">
            {course && !course.slug
              ? 'One of their onboarding tiles rather than a course, so it has no curriculum to read.'
              : 'No lessons in reach for this course.'}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lessons.map((row) =>
              row.video === false ? (
                <TextRow
                  key={row.id}
                  title={row.title}
                  onRead={() => reader.open(view.courseId, row.id, row.title)}
                  onOpenTab={() => reader.openTab(view.courseId, row.id)}
                />
              ) : (
                <Row
                  key={row.id}
                  title={row.title}
                  meta={row.duration ?? undefined}
                  active={lesson?.courseId === view.courseId && lesson.lessonId === row.id}
                  onClick={() =>
                    dispatch({ type: 'lessonPicked', courseId: view.courseId, lessonId: row.id })
                  }
                />
              ),
            )}
          </div>
        )}

        <StubNote>
          Phase 6 marks watched lessons from our own record and opens the earliest unwatched
          one, since nothing persists progress today.
        </StubNote>
      </Screen>

      {reader.node}
    </>
  );
}
