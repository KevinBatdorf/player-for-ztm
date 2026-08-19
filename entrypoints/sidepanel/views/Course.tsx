import type { Dispatch } from 'react';
import { IndexerNotice, Row, Screen, StubNote } from '../Screen';
import { findCourse } from '@/lib/fixtures';
import type { Action, IndexerProgress, ViewOf } from '@/lib/machine';

export function Course({
  view,
  indexer,
  dispatch,
}: {
  view: ViewOf<'course'>;
  indexer: IndexerProgress;
  dispatch: Dispatch<Action>;
}) {
  const course = findCourse(view.courseId);

  return (
    <Screen title={course?.title ?? view.courseId} onBack={() => dispatch({ type: 'wentHome' })}>
      <IndexerNotice indexer={indexer} />

      <div className="flex flex-col gap-1.5">
        {course?.lessons.map((lesson) => (
          <Row
            key={lesson.id}
            title={lesson.title}
            meta={lesson.duration}
            onClick={() =>
              dispatch({ type: 'lessonPicked', courseId: view.courseId, lessonId: lesson.id })
            }
          />
        ))}
      </div>

      <StubNote>
        Phase 5 marks watched lessons from our own record and opens the earliest unwatched
        one, since nothing persists progress today.
      </StubNote>
    </Screen>
  );
}
