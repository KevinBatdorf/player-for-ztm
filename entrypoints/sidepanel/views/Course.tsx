import { useEffect, type Dispatch } from 'react';
import { useLibrary } from '../library';
import { useReader } from '../Reader';
import { Cta, Row, Screen, StubNote, TextRow } from '../Screen';
import { useHold } from '../settings';
import { fixtureLessons } from '@/lib/fixtures';
import type { Action, Loaded, ViewOf } from '@/lib/machine';

export function Course({
  view,
  lesson,
  dispatch,
}: {
  view: ViewOf<'course'> | ViewOf<'courseLoading'>;
  lesson: Loaded | null;
  dispatch: Dispatch<Action>;
}) {
  const { courses, lessonsFor, openCourse, sweepText, seen, resumeIn } = useLibrary();
  const reader = useReader();
  const held = useHold();

  const course = courses?.find((c) => c.id === view.courseId);
  // The dev panel can jump straight here, so the stubs stay reachable without a session.
  const lessons = courses ? lessonsFor(view.courseId) : fixtureLessons(view.courseId);
  const pending = view.name === 'courseLoading';
  const resume = resumeIn(view.courseId);

  // Titles are already in hand from the catalogue; this fetch is only durations and type.
  useEffect(() => {
    if (!pending || held) return;
    let live = true;

    void openCourse(view.courseId).then(() => {
      if (live) dispatch({ type: 'courseReady', courseId: view.courseId });
    });

    return () => {
      live = false;
    };
  }, [dispatch, openCourse, view.courseId, pending, held]);

  useEffect(() => {
    if (courses) sweepText(view.courseId);
  }, [courses, sweepText, view.courseId]);

  return (
    <>
      <Screen title={course?.title ?? view.courseId} onBack={() => dispatch({ type: 'wentHome' })}>
        {resume && resume.id !== lesson?.lessonId && (
          <Cta
            onClick={() =>
              dispatch({ type: 'lessonPicked', courseId: view.courseId, lessonId: resume.id })
            }
          >
            <span className="block truncate">Resume — {resume.title}</span>
          </Cta>
        )}

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
                  done={seen(view.courseId, row.id)}
                  onClick={() =>
                    dispatch({ type: 'lessonPicked', courseId: view.courseId, lessonId: row.id })
                  }
                />
              ),
            )}
          </div>
        )}

        {pending && (
          <StubNote>
            Durations and lesson type are still on their way; the titles came with the catalogue.
          </StubNote>
        )}
      </Screen>

      {reader.node}
    </>
  );
}
