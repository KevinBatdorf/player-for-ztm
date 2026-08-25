import type { Course } from '@/lib/courses';
import type { Lesson } from '@/lib/lessons';

/** Their titles space and punctuate as they like: "Web Assembly" has to answer to "webassembly". */
export const flatten = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Their index answers "wasm" with nothing, so shorthand can only be joined up here. */
const ALIASES: Record<string, string[]> = {
  ai: ['artificialintelligence'],
  cicd: ['continuousintegration', 'devops'],
  cs: ['csharp'],
  css3: ['css'],
  db: ['database'],
  ds: ['datascience'],
  html5: ['html'],
  js: ['javascript'],
  k8s: ['kubernetes'],
  ml: ['machinelearning'],
  next: ['nextjs'],
  node: ['nodejs'],
  postgres: ['postgresql'],
  py: ['python'],
  react: ['reactjs'],
  rn: ['reactnative'],
  ts: ['typescript'],
  vue: ['vuejs'],
  wasm: ['webassembly'],
};

/** Short words are their own tokens: "go" inside "google" is not a hit. */
const SHORT = 4;

/** Longer words carry more room to be mistyped without becoming another word. */
const near = (token: string) => (token.length >= 8 ? 2 : 1);

const within = (a: string, b: string, allowed: number): boolean => {
  if (Math.abs(a.length - b.length) > allowed) return false;

  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        next[j - 1]! + 1,
        row[j]! + 1,
        row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    row = next;
  }

  return row[b.length]! <= allowed;
};

export type Haystack = { blob: string; words: string[] };

/** A course and everything under it, flattened once so a keystroke does not rebuild it. */
export const haystackOf = (course: Course, lessons: Lesson[]): Haystack => {
  const titles = [course.title, ...lessons.map((lesson) => lesson.title)];
  return {
    blob: titles.map(flatten).join(' '),
    words: titles
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  };
};

const found = (hay: Haystack, token: string): boolean => {
  if (hay.blob.includes(token)) return true;
  if (token.length < SHORT) return hay.words.includes(token);
  return hay.words.some((word) => within(token, word, near(token)));
};

/** Every word typed has to land somewhere, itself or through what it stands for. */
export function hits(hay: Haystack, query: string): boolean {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (!tokens.length) return true;

  return tokens.every((token) => [token, ...(ALIASES[token] ?? [])].some((word) => found(hay, word)));
}
