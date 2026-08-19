import type { Dispatch } from 'react';
import { Button, Screen, Simulate, StubNote } from '../Screen';
import { findCourse, findLesson, nextLesson } from '@/lib/fixtures';
import type { Action, ViewOf } from '@/lib/machine';

export function Playing({
  view,
  dispatch,
}: {
  view: ViewOf<'playing'>;
  dispatch: Dispatch<Action>;
}) {
  const course = findCourse(view.courseId);
  const lesson = findLesson(view.courseId, view.lessonId);
  const next = nextLesson(view.courseId, view.lessonId);

  return (
    <Screen
      title={lesson?.title ?? view.lessonId}
      onBack={() => dispatch({ type: 'playerClosed' })}
    >
      <div className="rule flex aspect-video items-center justify-center rounded-panel bg-raised">
        <span className="font-mono text-caption text-ink-faint">player frame</span>
      </div>
      <p className="truncate text-caption text-ink-soft">{course?.title ?? view.courseId}</p>

      <StubNote>
        Phase 5 decides which document owns this frame before writing anything into it, and
        Play / Pop out live inside the frame — Picture-in-Picture can only be requested by
        the document that owns the video.
      </StubNote>

      <Simulate>
        <Button
          primary
          onClick={() => dispatch({ type: 'lessonEnded', nextLessonId: next?.id ?? null })}
        >
          {next ? `ended → ${next.title}` : 'ended → end of course'}
        </Button>
      </Simulate>
    </Screen>
  );
}
