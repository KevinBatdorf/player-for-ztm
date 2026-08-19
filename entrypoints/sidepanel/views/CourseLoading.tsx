import type { Dispatch } from 'react';
import { Button, Screen, Simulate, StubNote } from '../Screen';
import { findCourse } from '@/lib/fixtures';
import type { Action, ViewOf } from '@/lib/machine';

export function CourseLoading({
  view,
  dispatch,
}: {
  view: ViewOf<'courseLoading'>;
  dispatch: Dispatch<Action>;
}) {
  const course = findCourse(view.courseId);

  return (
    <Screen title={course?.title ?? view.courseId} onBack={() => dispatch({ type: 'wentHome' })}>
      <p className="text-body text-ink-soft">Loading lessons…</p>
      <StubNote>
        Phase 4 moves this course to the head of the index queue instead of waiting for the
        sweep to reach it. Priority insertion, not a burst.
      </StubNote>
      <Simulate>
        <Button primary onClick={() => dispatch({ type: 'courseReady', courseId: view.courseId })}>
          lessons ready
        </Button>
      </Simulate>
    </Screen>
  );
}
