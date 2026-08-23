import { browser } from '#imports';
import { useCallback, useEffect, useState } from 'react';
import { useLibrary } from './library';
import { Markdown } from './markdown';
import { lectureUrl } from '@/lib/lecture';
import type { CourseId, LessonId } from '@/lib/machine';

type At = { courseId: CourseId; lessonId: LessonId; title: string; slug: string | null };

/** `node` must render as a sibling of `Screen`; inside its scroller it is clipped. */
export function useReader() {
  const { courses, bodyFor, readLesson } = useLibrary();
  const [at, setAt] = useState<At | null>(null);

  const open = useCallback(
    (courseId: CourseId, lessonId: LessonId, title: string) => {
      const course = courses?.find((c) => c.id === courseId);
      setAt({ courseId, lessonId, title, slug: course?.slug ?? null });
      // The sweep may not have reached this one yet.
      readLesson(courseId, lessonId);
    },
    [courses, readLesson],
  );

  const openTab = useCallback((courseId: CourseId, lessonId: LessonId) => {
    const course = courses?.find((c) => c.id === courseId);
    if (course?.slug) void browser.tabs.create({ url: lectureUrl(course.slug, lessonId) });
  }, [courses]);

  const node = at ? (
    <Reader
      title={at.title}
      body={bodyFor(at.courseId, at.lessonId)}
      onOpenTab={() => openTab(at.courseId, at.lessonId)}
      onClose={() => setAt(null)}
    />
  ) : null;

  return { open, openTab, node };
}

export function Reader({
  title,
  body,
  onOpenTab,
  onClose,
}: {
  title: string;
  body: string | undefined;
  onOpenTab: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-sheet">
      <header className="rule-b flex shrink-0 items-center gap-3 px-8 py-4">
        <h1 className="min-w-0 flex-1 text-heading leading-snug font-medium text-ink">{title}</h1>

        <button
          type="button"
          onClick={onOpenTab}
          className="rule shrink-0 rounded-panel px-1.5 py-0.5 font-mono text-caption text-ink-soft transition-colors duration-150 ease-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          open tab
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rule shrink-0 rounded-panel px-1.5 py-0.5 font-mono text-caption text-ink-faint transition-colors duration-150 ease-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-8">
        {body === undefined ? (
          <p className="text-body text-ink-soft">Fetching this lesson…</p>
        ) : body ? (
          <Markdown text={body} />
        ) : (
          <p className="text-body text-ink-soft">
            Nothing readable came back for this one. Open it in a tab instead.
          </p>
        )}
      </div>
    </div>
  );
}
