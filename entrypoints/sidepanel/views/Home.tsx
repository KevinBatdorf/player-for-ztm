import type { Dispatch } from 'react';
import { useLibrary } from '../library';
import SpotlightCard from '@/components/react-bits/spotlight-card';
import { Row, Screen, StubNote } from '../Screen';
import { useVariant } from '../settings';
import { byUpdated } from '@/lib/courses';
import { fixtureCourses } from '@/lib/fixtures';
import type { Action } from '@/lib/machine';

/** The accent, as the literal rgba that component's prop type demands. */
const SPOTLIGHT = 'rgba(199, 146, 234, 0.18)' as const;

export function Home({ dispatch }: { dispatch: Dispatch<Action> }) {
  const variant = useVariant('home');
  const { courses } = useLibrary();
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

      {variant === 'list' ? (
        <div className="flex flex-col gap-1.5">
          {list.map((course) => (
            <Row
              key={course.id}
              title={course.title}
              meta={course.updated?.slice(0, 7)}
              onClick={() => dispatch({ type: 'coursePicked', courseId: course.id })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((course) => (
            <SpotlightCard key={course.id} className="p-0" spotlightColor={SPOTLIGHT}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'coursePicked', courseId: course.id })}
                className="block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
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
                <span className="block p-2.5">
                  <span className="block text-body leading-snug text-ink">{course.title}</span>
                  {course.updated && (
                    <span className="mt-1 block font-mono text-caption text-ink-faint">
                      updated {course.updated.slice(0, 7)}
                    </span>
                  )}
                </span>
              </button>
            </SpotlightCard>
          ))}
        </div>
      )}

      {!real && (
        <StubNote>
          Fixtures — the dev panel jumped here without a session, so nothing was fetched.
        </StubNote>
      )}
    </Screen>
  );
}
