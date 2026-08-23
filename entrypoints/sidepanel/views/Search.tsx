import type { Dispatch } from 'react';
import { useLibrary } from '../library';
import { useHoverPrefetch } from '../prefetch';
import { Row, Screen } from '../Screen';
import { fixtureCourses, fixtureLessons } from '@/lib/fixtures';
import type { Course } from '@/lib/courses';
import type { Lesson } from '@/lib/lessons';
import type { Action, Loaded, ViewOf } from '@/lib/machine';

/** Six thousand lesson titles are in reach, and a 400px column is not where they go. */
const LIMIT = 40;

export function Search({
  view,
  lesson,
  dispatch,
}: {
  view: ViewOf<'search'>;
  lesson: Loaded | null;
  dispatch: Dispatch<Action>;
}) {
  const library = useLibrary();
  const hover = useHoverPrefetch();
  // The dev panel can jump straight here, so the stubs stay reachable without a session.
  const courses = library.courses ?? fixtureCourses();
  const lessonsFor = library.courses ? library.lessonsFor : fixtureLessons;

  const query = view.query.trim().toLowerCase();
  const hits = query ? matches(courses, lessonsFor, query) : null;

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

      {hits?.courses.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-caption text-ink-faint">courses</p>
          {hits.courses.map((course) => (
            <Row
              key={course.id}
              title={course.title}
              meta={course.updated?.slice(0, 7)}
              onClick={() => dispatch({ type: 'coursePicked', courseId: course.id })}
              {...hover(course.id)}
            />
          ))}
        </div>
      ) : null}

      {/* Grouped by course, because a lesson title alone is ambiguous across thirty of them. */}
      {hits?.groups.map(({ course, lessons }) => (
        <div key={course.id} className="flex flex-col gap-1.5">
          <p className="truncate font-mono text-caption text-ink-faint">{course.title}</p>
          {lessons.map((row) => (
            <Row
              key={row.id}
              title={row.title}
              meta={row.duration ?? (row.video === false ? 'text' : undefined)}
              disabled={row.video === false}
              active={lesson?.courseId === course.id && lesson.lessonId === row.id}
              onClick={() =>
                dispatch({ type: 'lessonPicked', courseId: course.id, lessonId: row.id })
              }
            />
          ))}
        </div>
      ))}

      {hits && hits.hidden > 0 && (
        <p className="font-mono text-caption text-ink-faint">
          +{hits.hidden} more lessons — narrow the search
        </p>
      )}

      {hits && !hits.courses.length && !hits.groups.length && (
        <p className="text-body text-ink-soft">No matches.</p>
      )}
    </Screen>
  );
}

type Hits = {
  courses: Course[];
  groups: { course: Course; lessons: Lesson[] }[];
  hidden: number;
};

/** Enrolled courses only: a result he cannot open is not a result. */
function matches(
  courses: Course[],
  lessonsFor: (courseId: string) => Lesson[],
  query: string,
): Hits {
  const groups: Hits['groups'] = [];
  let shown = 0;
  let found = 0;

  for (const course of courses) {
    const lessons = lessonsFor(course.id).filter((lesson) =>
      lesson.title.toLowerCase().includes(query),
    );
    if (!lessons.length) continue;

    found += lessons.length;
    if (shown >= LIMIT) continue;

    const take = lessons.slice(0, LIMIT - shown);
    groups.push({ course, lessons: take });
    shown += take.length;
  }

  return {
    courses: courses.filter((course) => course.title.toLowerCase().includes(query)),
    groups,
    hidden: found - shown,
  };
}
