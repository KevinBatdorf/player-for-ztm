import { Music2, Play } from 'lucide-react';
import type { Dispatch } from 'react';
import { useLibrary } from '../library';
import { useHoverPrefetch } from '../prefetch';
import { Screen } from '../Screen';
import { Button } from '@/components/ui/button';
import { byUpdated, type Course } from '@/lib/courses';
import { runtimeOf } from '@/lib/lessons';
import type { Action, Loaded } from '@/lib/machine';

export function Home({ lesson, dispatch }: { lesson: Loaded | null; dispatch: Dispatch<Action> }) {
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
          <Card
            key={course.id}
            course={course}
            playing={lesson?.courseId === course.id}
            dispatch={dispatch}
            {...hover(course.id)}
          />
        ))}
      </div>
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
              {resume && (
                <Button
                  variant="silver"
                  size="xs"
                  onClick={() =>
                    dispatch({ type: 'lessonPicked', courseId: course.id, lessonId: resume.id })
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
