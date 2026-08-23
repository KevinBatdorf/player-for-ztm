import { useEffect, type Dispatch } from 'react';
import { useLibrary } from '../library';
import { Screen } from '../Screen';
import { useHold } from '../settings';
import type { Action, ViewOf } from '@/lib/machine';

export function CourseLoading({
  view,
  dispatch,
}: {
  view: ViewOf<'courseLoading'>;
  dispatch: Dispatch<Action>;
}) {
  const { courses, openCourse } = useLibrary();
  const course = courses?.find((c) => c.id === view.courseId);
  const held = useHold();

  // Titles are already in hand from the catalogue, so the only wait here is the
  // curriculum page — durations and which lessons are text rather than video.
  useEffect(() => {
    if (held) return;
    let live = true;

    void openCourse(view.courseId).then(() => {
      if (live) dispatch({ type: 'courseReady', courseId: view.courseId });
    });

    return () => {
      live = false;
    };
  }, [dispatch, openCourse, view.courseId, held]);

  return (
    <Screen title={course?.title ?? view.courseId} onBack={() => dispatch({ type: 'wentHome' })}>
      <p className="text-body text-ink-soft">Reading the curriculum…</p>
    </Screen>
  );
}
