import type { Dispatch } from 'react';
import { IndexerNotice, Row, Screen, StubNote } from '../Screen';
import { SAMPLE_COURSES } from '@/lib/fixtures';
import type { Action, IndexerProgress, ViewOf } from '@/lib/machine';

export function Search({
  view,
  indexer,
  dispatch,
}: {
  view: ViewOf<'search'>;
  indexer: IndexerProgress;
  dispatch: Dispatch<Action>;
}) {
  const query = view.query.trim().toLowerCase();
  const courses = query
    ? SAMPLE_COURSES.filter((c) => c.title.toLowerCase().includes(query))
    : [];
  const lessons = query
    ? SAMPLE_COURSES.flatMap((course) =>
        course.lessons
          .filter((lesson) => lesson.title.toLowerCase().includes(query))
          .map((lesson) => ({ course, lesson })),
      )
    : [];

  return (
    <Screen title="Search" onBack={() => dispatch({ type: 'searchClosed' })}>
      <input
        type="search"
        autoFocus
        value={view.query}
        placeholder="Search courses and lessons"
        onChange={(e) => dispatch({ type: 'searchChanged', query: e.target.value })}
        className="rule w-full rounded-panel bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      <IndexerNotice indexer={indexer} />

      {courses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-caption text-ink-faint">courses</p>
          {courses.map((course) => (
            <Row
              key={course.id}
              title={course.title}
              meta={course.released.slice(0, 7)}
              onClick={() => dispatch({ type: 'coursePicked', courseId: course.id })}
            />
          ))}
        </div>
      )}

      {lessons.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-caption text-ink-faint">lessons</p>
          {lessons.map(({ course, lesson }) => (
            <Row
              key={`${course.id}/${lesson.id}`}
              title={lesson.title}
              meta={lesson.duration}
              onClick={() =>
                dispatch({ type: 'lessonPicked', courseId: course.id, lessonId: lesson.id })
              }
            />
          ))}
        </div>
      )}

      {query && courses.length === 0 && lessons.length === 0 && (
        <p className="text-body text-ink-soft">No matches.</p>
      )}

      <StubNote>
        Phase 4 searches the swept index instead of this fixture, and the notice above has to
        make partial results honest rather than empty — that is the whole design problem in
        that phase.
      </StubNote>
    </Screen>
  );
}
