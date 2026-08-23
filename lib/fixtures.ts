import type { Course } from '@/lib/courses';
import type { Lesson } from '@/lib/lessons';

// Scaffolding for the stub screens; it leaves with them once real data lands.
export type SampleLesson = { id: string; title: string; duration: string };

export type SampleCourse = {
  id: string;
  title: string;
  released: string;
  lessons: SampleLesson[];
};

/** Named so the dev panel can jump into a course without indexing into the list. */
export const SAMPLE_COURSE: SampleCourse = {
  id: 'react-zero-to-mastery',
  title: 'React: Zero to Mastery',
  released: '2025-02-18',
  lessons: [
    { id: 'rx-1', title: 'Why React Exists', duration: '7:05' },
    { id: 'rx-2', title: 'Components and Props', duration: '14:20' },
    { id: 'rx-3', title: 'State and the Render Loop', duration: '19:55' },
    { id: 'rx-4', title: 'Async Data in Effects', duration: '25:31' },
  ],
};

export const SAMPLE_COURSES: SampleCourse[] = [
  {
    id: 'complete-python-developer',
    title: 'Complete Python Developer',
    released: '2024-11-04',
    lessons: [
      { id: 'py-1', title: 'Python Introduction', duration: '4:12' },
      { id: 'py-2', title: 'Data Types and Variables', duration: '11:38' },
      { id: 'py-3', title: 'Functions, Scope and Closures', duration: '18:02' },
      { id: 'py-4', title: 'Async and Await', duration: '22:47' },
    ],
  },
  SAMPLE_COURSE,
  {
    id: 'typescript-zero-to-mastery',
    title: 'TypeScript: Zero to Mastery',
    released: '2025-06-09',
    lessons: [
      { id: 'ts-1', title: 'Structural Typing', duration: '9:44' },
      { id: 'ts-2', title: 'Discriminated Unions', duration: '16:12' },
      { id: 'ts-3', title: 'Generics Without Fear', duration: '21:08' },
    ],
  },
  {
    id: 'master-the-coding-interview',
    title: 'Master the Coding Interview',
    released: '2025-08-01',
    lessons: [
      { id: 'ci-1', title: 'Big O Notation', duration: '12:30' },
      { id: 'ci-2', title: 'Hash Tables', duration: '17:49' },
      { id: 'ci-3', title: 'Dynamic Programming', duration: '28:16' },
    ],
  },
  {
    id: 'complete-sql-and-databases',
    title: 'Complete SQL + Databases',
    released: '2026-01-22',
    lessons: [
      { id: 'sq-1', title: 'Relational Thinking', duration: '10:03' },
      { id: 'sq-2', title: 'Joins in Anger', duration: '20:41' },
      { id: 'sq-3', title: 'Indexes and Query Plans', duration: '24:09' },
    ],
  },
];

export const findCourse = (courseId: string): SampleCourse | undefined =>
  SAMPLE_COURSES.find((c) => c.id === courseId);

/** The real shapes, so a view reads one list and not two. */
export const fixtureCourses = (): Course[] =>
  SAMPLE_COURSES.map((c) => ({ id: c.id, title: c.title, image: '', slug: null, updated: c.released }));

export const fixtureLessons = (courseId: string): Lesson[] =>
  findCourse(courseId)?.lessons.map((l) => ({
    id: l.id,
    title: l.title,
    duration: l.duration,
    video: true,
  })) ?? [];
