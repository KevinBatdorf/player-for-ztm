import { Play } from 'lucide-react';
import type { Dispatch } from 'react';
import { useLibrary } from '../library';
import { useHoverPrefetch } from '../prefetch';
import { Button, Screen } from '../Screen';
import { byUpdated, type Course } from '@/lib/courses';
import { runtimeOf } from '@/lib/lessons';
import type { Action } from '@/lib/machine';

export function Home({ dispatch }: { dispatch: Dispatch<Action> }) {
  const { courses } = useLibrary();
  const hover = useHoverPrefetch();
  const list = byUpdated(courses ?? []);

  return (
    <Screen>
      {/* Focus is the transition: search is its own view, never a filter over this one. */}
      <input
        type="search"
        placeholder="Search courses and lessons"
        onFocus={() => dispatch({ type: 'searchOpened' })}
        className="rule w-full rounded-panel bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      <div className="flex flex-col gap-2">
        {list.map((course) => (
          <Card key={course.id} course={course} dispatch={dispatch} {...hover(course.id)} />
        ))}
      </div>
    </Screen>
  );
}

function Card({
  course,
  dispatch,
  onPointerEnter,
  onPointerLeave,
}: {
  course: Course;
  dispatch: Dispatch<Action>;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  const { resumeIn, watchedCount } = useLibrary();

  const open = () => dispatch({ type: 'coursePicked', courseId: course.id });
  const resume = resumeIn(course.id);
  const started = watchedCount(course.id) > 0;

  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="group rule relative overflow-hidden rounded-panel bg-card transition-colors duration-150 ease-panel hover:bg-card-hover"
    >
      {/* Their CDN art is the only image in the app; a missing one leaves the card plain. */}
      {course.image && (
        <div className="relative">
          <img
            src={course.image}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <Details course={course} />
        </div>
      )}

      <p className="px-3 py-2.5 text-body leading-snug text-ink">{course.title}</p>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-1.5 bg-gradient-to-b from-paper/90 to-transparent p-2 pb-8 opacity-0 transition-opacity duration-200 ease-panel group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <Button onClick={open}>view</Button>
        {resume && (
          <Button
            primary
            onClick={() =>
              dispatch({ type: 'lessonPicked', courseId: course.id, lessonId: resume.id })
            }
          >
            <Play size={10} fill="currentColor" strokeWidth={0} aria-hidden />
            {started ? 'continue' : 'start'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Hovering is already what prefetches the curriculum, so the runtime fills in late. */
function Details({ course }: { course: Course }) {
  const { lessonsFor, watchedCount } = useLibrary();

  const lessons = lessonsFor(course.id);
  const runtime = runtimeOf(lessons);
  const watched = watchedCount(course.id);
  const month = course.updated?.slice(0, 7);

  const counts = [lessons.length ? `${lessons.length} lessons` : null, runtime].filter(Boolean);
  const rest = [month && `updated ${month}`, watched && `${watched} watched`].filter(Boolean);
  if (!counts.length && !rest.length) return null;

  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-paper via-paper/85 to-transparent px-3 pt-10 pb-2.5 opacity-0 transition-opacity duration-200 ease-panel group-hover:opacity-100 group-focus-visible:opacity-100">
      {counts.length > 0 && (
        <span className="font-mono text-caption text-ink">{counts.join(' · ')}</span>
      )}
      {rest.length > 0 && (
        <span className="font-mono text-caption text-ink-faint">{rest.join(' · ')}</span>
      )}
    </span>
  );
}
