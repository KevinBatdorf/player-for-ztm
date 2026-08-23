import type { Dispatch } from 'react';
import { useCourses } from '../courses';
import SpotlightCard from '@/components/react-bits/spotlight-card';
import { Button, IndexerNotice, Row, Screen, Simulate, StubNote } from '../Screen';
import { useFlair, useVariant } from '../settings';
import { byUpdated, type Course } from '@/lib/courses';
import { SAMPLE_COURSE, SAMPLE_COURSES, SAMPLE_LESSON } from '@/lib/fixtures';
import type { Action, IndexerProgress } from '@/lib/machine';
import { cn } from '@/lib/utils';

/** The accent, as the literal rgba that component's prop type demands. */
const SPOTLIGHT = 'rgba(199, 146, 234, 0.18)' as const;

/** The dev panel can jump straight here, so the stubs stay reachable without a session. */
const asCourses = (samples: typeof SAMPLE_COURSES): Course[] =>
  samples.map((s) => ({ id: s.id, title: s.title, image: '', slug: null, updated: s.released }));

export function Home({
  indexer,
  dispatch,
}: {
  indexer: IndexerProgress;
  dispatch: Dispatch<Action>;
}) {
  const variant = useVariant('home');
  const flair = useFlair();
  const { courses } = useCourses();
  const real = courses !== null;
  const list = byUpdated(real ? courses : asCourses(SAMPLE_COURSES));

  return (
    <Screen>
      {real ? (
        <StubNote>
          The lesson most recently played sits here from phase 5, which is where the watched
          record it reads gets written.
        </StubNote>
      ) : (
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'lessonPicked',
              courseId: SAMPLE_COURSE.id,
              lessonId: SAMPLE_LESSON.id,
            })
          }
          className={cn(
            'rule w-full rounded-panel bg-raised p-3 text-left shadow-panel transition-colors duration-150 ease-panel',
            'hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            flair === 'full' && 'animate-in fade-in slide-in-from-bottom-1 duration-300',
          )}
        >
          <span className="block font-mono text-caption text-accent-text">continue</span>
          <span className="mt-1 block text-heading leading-snug text-ink">{SAMPLE_LESSON.title}</span>
          <span className="mt-0.5 block text-caption text-ink-soft">
            {SAMPLE_COURSE.title}
          </span>
        </button>
      )}

      {/* Focus is the transition: search is its own view, never a filter over this one. */}
      <input
        type="search"
        placeholder="Search courses and lessons"
        onFocus={() => dispatch({ type: 'searchOpened' })}
        className="rule w-full rounded-panel bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      <IndexerNotice indexer={indexer} />

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

      <Simulate>
        <Button
          onClick={() =>
            dispatch({
              type: 'indexerProgressed',
              done: Math.min(indexer.done + 7, 95),
              total: 95,
            })
          }
        >
          index 7 more
        </Button>
        <Button onClick={() => dispatch({ type: 'indexerProgressed', done: 0, total: 0 })}>
          reset index
        </Button>
      </Simulate>
    </Screen>
  );
}
