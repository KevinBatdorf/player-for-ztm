import type { Dispatch } from 'react';
import { useLibrary } from '../library';
import { useHoverPrefetch } from '../prefetch';
import { Screen, StubNote } from '../Screen';
import { byUpdated } from '@/lib/courses';
import { fixtureCourses } from '@/lib/fixtures';
import type { Action } from '@/lib/machine';

export function Home({ dispatch }: { dispatch: Dispatch<Action> }) {
  const { courses } = useLibrary();
  const hover = useHoverPrefetch();
  const real = courses !== null;
  // The dev panel can jump straight here, so the stubs stay reachable without a session.
  const list = byUpdated(real ? courses : fixtureCourses());

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
            className="rule block w-full overflow-hidden rounded-panel bg-card text-left transition-colors duration-150 ease-panel hover:bg-card-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            {/* Their CDN art is the only image in the app; a missing one leaves the card plain. */}
            {course.image && (
              <img
                src={course.image}
                alt=""
                loading="lazy"
                className="aspect-video w-full object-cover"
              />
            )}
            <span className="block px-3 py-2.5">
              <span className="block text-body leading-snug text-ink">{course.title}</span>
              {course.updated && (
                <span className="mt-1 block font-mono text-caption text-ink-faint">
                  updated {course.updated.slice(0, 7)}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {!real && (
        <StubNote>
          Fixtures — the dev panel jumped here without a session, so nothing was fetched.
        </StubNote>
      )}
    </Screen>
  );
}
