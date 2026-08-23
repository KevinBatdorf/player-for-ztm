import type { Dispatch } from 'react';
import { useLibrary } from '../library';
import { Row, Screen, StubNote } from '../Screen';
import { fixtureLessons } from '@/lib/fixtures';
import type { Lesson } from '@/lib/lessons';
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
  const { courses, lessonsFor } = useLibrary();
  const course = courses?.find((c) => c.id === view.courseId);
  // The dev panel can jump straight here, so the stubs stay reachable without a session.
  const lessons = courses ? lessonsFor(view.courseId) : fixtureLessons(view.courseId);

  return (
    <Screen title={course?.title ?? view.courseId} onBack={() => dispatch({ type: 'wentHome' })}>
      {lessons.length === 0 ? (
        <p className="text-body text-ink-soft">
          {course && !course.slug
            ? 'One of their onboarding tiles rather than a course, so it has no curriculum to read.'
            : 'No lessons in reach for this course.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lessons.map((row) => (
            <Row
              key={row.id}
              title={row.title}
              meta={meta(row)}
              disabled={row.video === false}
              active={lesson?.courseId === view.courseId && lesson.lessonId === row.id}
              onClick={() =>
                dispatch({ type: 'lessonPicked', courseId: view.courseId, lessonId: row.id })
              }
            />
          ))}
        </div>
      )}

      <StubNote>
        Phase 5 marks watched lessons from our own record and opens the earliest unwatched
        one, since nothing persists progress today.
      </StubNote>
    </Screen>
  );
}

/** A text lesson has no duration to show, and blank would read as one still loading. */
const meta = (lesson: Lesson) =>
  lesson.duration ?? (lesson.video === false ? 'text' : undefined);
