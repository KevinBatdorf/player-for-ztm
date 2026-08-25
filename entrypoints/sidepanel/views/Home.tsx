import { Music2, Play } from 'lucide-react';
import { useMemo, useState, type Dispatch } from 'react';
import { browser } from '#imports';
import { useLibrary } from '../library';
import { useHoverPrefetch } from '../prefetch';
import { Screen } from '../Screen';
import { Button } from '@/components/ui/button';
import { byUpdated, type Course } from '@/lib/courses';
import { runtimeOf } from '@/lib/lessons';
import type { Action, Loaded } from '@/lib/machine';
import { haystackOf, hits } from '@/lib/search';

export function Home({ lesson, dispatch }: { lesson: Loaded | null; dispatch: Dispatch<Action> }) {
  const { courses, lessonsFor, catalog } = useLibrary();
  const hover = useHoverPrefetch();
  const [query, setQuery] = useState('');

  const shelf = useMemo(
    () =>
      byUpdated(courses ?? []).map((course) => ({
        course,
        hay: haystackOf(course.title, lessonsFor(course.id)),
        titled: haystackOf(course.title, []),
      })),
    [courses, lessonsFor],
  );

  // The shelf is what has been started; the rest of their catalogue is a tab away.
  const unstarted = useMemo(() => {
    const started = new Set(shelf.map((row) => row.course.slug));
    return catalog
      .filter((entry) => !started.has(entry.slug))
      .map((entry) => ({ entry, hay: haystackOf(entry.title, []) }));
  }, [catalog, shelf]);

  const term = query.trim();

  const list = useMemo(() => {
    const found = shelf.filter((row) => hits(row.hay, term));
    if (!term) return found.map((row) => row.course);

    return found
      .map((row) => ({ row, rank: hits(row.titled, term) ? 0 : 1 }))
      // Stable sort, so newest-first still holds inside each rank.
      .sort((a, b) => a.rank - b.rank)
      .map(({ row }) => row.course);
  }, [shelf, term]);

  const rest = term
    ? unstarted.filter((row) => hits(row.hay, term)).map((row) => row.entry)
    : [];

  return (
    <Screen>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search courses and lessons"
        className="rule w-full rounded-panel bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      {term && !list.length && !rest.length && (
        <p className="text-body text-ink-soft">No matches.</p>
      )}

      <p className="font-mono text-caption text-ink-faint">
        {term ? `${list.length} of ${shelf.length} courses` : `${shelf.length} courses`}
      </p>

      <div className="flex flex-col gap-2">
        {list.map((course) => (
          <Card
            key={course.id}
            course={course}
            playing={lesson?.courseId === course.id}
            dispatch={dispatch}
            {...hover(course.id)}
          />
        ))}
      </div>

      {rest.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-caption text-ink-faint">not started yet</p>

          {rest.map((entry) => (
            <div
              key={entry.slug}
              className="rule flex items-center justify-between gap-2 rounded-panel bg-card/60 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-body leading-snug text-ink-soft">
                {entry.title}
              </span>

              <Button
                variant="silver"
                size="xs"
                className="shrink-0"
                onClick={() =>
                  void browser.tabs.create({
                    url: `https://academy.zerotomastery.io/courses/${entry.slug}`,
                  })
                }
              >
                open on ZTM
              </Button>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}

function Card({
  course,
  playing,
  dispatch,
  onPointerEnter,
  onPointerLeave,
}: {
  course: Course;
  playing: boolean;
  dispatch: Dispatch<Action>;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  const { lessonsFor, resumeIn, watchedCount } = useLibrary();

  const lessons = lessonsFor(course.id);
  const runtime = runtimeOf(lessons);
  const watched = watchedCount(course.id);
  const resume = resumeIn(course.id);
  const month = course.updated?.slice(0, 7);

  const counts = [lessons.length ? `${lessons.length} lessons` : null, runtime].filter(Boolean);
  const rest = [month && `updated ${month}`, watched && `${watched} watched`].filter(Boolean);

  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="group rule relative overflow-hidden rounded-panel bg-card transition-colors duration-150 ease-panel hover:bg-card-hover"
    >
      {playing && (
        <span className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1 rounded-panel bg-paper/85 px-1.5 py-0.5 font-mono text-caption text-ink">
          <Music2 className="size-2.5" aria-hidden />
          now playing
        </span>
      )}
      {/* Their CDN art is the only image in the app; a missing one leaves the card plain. */}
      {course.image && (
        <div className="relative">
          <img
            src={course.image}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover"
          />

          {/* The runtime lands late: hovering is what prefetches the curriculum it comes from. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-paper via-paper/85 to-transparent px-3 pt-10 pb-2.5 opacity-0 transition-opacity duration-200 ease-panel group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            {counts.length > 0 && (
              <span className="font-mono text-caption text-ink">{counts.join(' · ')}</span>
            )}
            {rest.length > 0 && (
              <span className="font-mono text-caption text-ink-faint">{rest.join(' · ')}</span>
            )}

            <div className="mt-1.5 flex gap-1.5">
              <Button
                variant="silver"
                size="xs"
                className="[--t-glint-at:50%_100%]"
                onClick={() => dispatch({ type: 'coursePicked', courseId: course.id })}
              >
                view
              </Button>
              {resume && playing && (
                <Button variant="silver" size="xs" disabled>
                  playing
                  <Music2 aria-hidden />
                </Button>
              )}

              {resume && !playing && (
                <Button
                  variant="silver"
                  size="xs"
                  onClick={() =>
                    dispatch({ type: 'lessonPlayed', courseId: course.id, lessonId: resume.id })
                  }
                >
                  {watched ? 'continue' : 'start'}
                  <Play fill="currentColor" strokeWidth={0} aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="px-3 py-2.5 text-body leading-snug text-ink">{course.title}</p>
    </div>
  );
}
