import type { Dispatch } from 'react';
import { Button, IndexerNotice, Row, Screen, Simulate, StubNote } from '../Screen';
import { useFlair, useVariant } from '../settings';
import { SAMPLE_COURSE, SAMPLE_COURSES, SAMPLE_LESSON } from '@/lib/fixtures';
import type { Action, IndexerProgress } from '@/lib/machine';
import { cn } from '@/lib/utils';

export function Home({
  indexer,
  dispatch,
}: {
  indexer: IndexerProgress;
  dispatch: Dispatch<Action>;
}) {
  const variant = useVariant('home');
  const flair = useFlair();
  const byRelease = [...SAMPLE_COURSES].sort((a, b) => b.released.localeCompare(a.released));

  return (
    <Screen title="Player for ZTM">
      <button
        type="button"
        onClick={() =>
          dispatch({ type: 'lessonPicked', courseId: SAMPLE_COURSE.id, lessonId: SAMPLE_LESSON.id })
        }
        className={cn(
          'rule w-full rounded-panel bg-raised p-3 text-left shadow-panel transition-colors duration-150 ease-panel',
          'hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          flair === 'full' && 'animate-in fade-in slide-in-from-bottom-1 duration-300',
        )}
      >
        <span className="block font-mono text-caption text-accent-text">continue</span>
        <span className="mt-1 block truncate text-heading text-ink">{SAMPLE_LESSON.title}</span>
        <span className="mt-0.5 block truncate text-caption text-ink-soft">
          {SAMPLE_COURSE.title}
        </span>
      </button>

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
          {byRelease.map((course) => (
            <Row
              key={course.id}
              title={course.title}
              meta={course.released.slice(0, 7)}
              onClick={() => dispatch({ type: 'coursePicked', courseId: course.id })}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {byRelease.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => dispatch({ type: 'coursePicked', courseId: course.id })}
              className="rule flex aspect-4/3 flex-col justify-end rounded-panel bg-raised p-2.5 text-left transition-colors duration-150 ease-panel hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="text-body leading-tight text-ink">{course.title}</span>
              <span className="mt-1 font-mono text-caption text-ink-faint">
                {course.released.slice(0, 7)}
              </span>
            </button>
          ))}
        </div>
      )}

      <StubNote>
        Phase 3 replaces these with the real course list, sorted by release date and cached
        to IndexedDB.
      </StubNote>

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
