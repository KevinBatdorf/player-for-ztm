import type { Dispatch } from 'react';
import { useLibrary } from '../library';
import { useHoverPrefetch } from '../prefetch';
import { Screen } from '../Screen';
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
          <button
            key={course.id}
            type="button"
            onClick={() => dispatch({ type: 'coursePicked', courseId: course.id })}
            {...hover(course.id)}
            className="group rule block w-full overflow-hidden rounded-panel bg-card text-left transition-colors duration-150 ease-panel hover:bg-card-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            {/* Their CDN art is the only image in the app; a missing one leaves the card plain. */}
            {course.image && (
              <span className="relative block">
                <img
                  src={course.image}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
                <Details course={course} />
              </span>
            )}
            <span className="block px-3 py-2.5 text-body leading-snug text-ink">
              {course.title}
            </span>
          </button>
        ))}
      </div>
    </Screen>
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
