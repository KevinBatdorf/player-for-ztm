import { browser } from '#imports';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLibrary } from './library';
import { Markdown } from './markdown';
import { Button } from '@/components/ui/button';
import { lectureUrl } from '@/lib/lecture';
import type { CourseId, LessonId } from '@/lib/machine';

type At = { courseId: CourseId; lessonId: LessonId; title: string; slug: string | null };

/** `node` must render as a sibling of `Screen`; inside its scroller it is clipped. */
export function useReader() {
  const { courses, bodyFor, readLesson, markWatched } = useLibrary();
  const [at, setAt] = useState<At | null>(null);

  const open = useCallback(
    (courseId: CourseId, lessonId: LessonId, title: string) => {
      const course = courses?.find((c) => c.id === courseId);
      setAt({ courseId, lessonId, title, slug: course?.slug ?? null });
      // The sweep may not have reached this one yet.
      readLesson(courseId, lessonId);
      // Nothing else can mark a text lesson: there is no player to report an end.
      markWatched(courseId, lessonId);
    },
    [courses, markWatched, readLesson],
  );

  const openTab = useCallback(
    (courseId: CourseId, lessonId: LessonId) => {
      const course = courses?.find((c) => c.id === courseId);
      if (!course?.slug) return;
      markWatched(courseId, lessonId);
      void browser.tabs.create({ url: lectureUrl(course.slug, lessonId) });
    },
    [courses, markWatched],
  );

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
      <header className="rule-b shrink-0 px-6 py-3.5">
        <h1 className="text-heading leading-snug font-medium text-ink">{title}</h1>

        <div className="mt-2.5 flex gap-1.5">
          <Button variant="silver" size="xs" onClick={onClose}>
            <X aria-hidden />
            close
          </Button>
          <Button variant="silver" size="xs" onClick={onOpenTab}>
            open tab
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
        {body === undefined ? (
          <p className="text-body text-ink-soft">Fetching this lesson…</p>
        ) : body ? (
          <Markdown text={body} />
        ) : (
          <p className="text-body text-ink-soft">
            This lesson would not load. Try opening it in a tab.
          </p>
        )}
      </div>
    </div>
  );
}
