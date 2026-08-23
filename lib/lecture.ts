import type { CourseId, LessonId } from '@/lib/machine';

const ORIGIN = 'https://academy.zerotomastery.io';

const REACH_MS = 15_000;

/** Answers `401 {"error":"Failed to Login"}` without a session. */
const api = (courseId: CourseId, lessonId: LessonId) =>
  `${ORIGIN}/api/v1/courses/${courseId}/lectures/${lessonId}`;

export const lectureUrl = (slug: string, lessonId: LessonId) =>
  `${ORIGIN}/courses/${slug}/lectures/${lessonId}`;

/** Their server-rendered wrapper; absent when the body is client-rendered. */
const TEXT = '.lecture-text-container';

type Attachment = { kind?: string; text?: string; body?: string; html?: string };

/** A few KB against the page's ~790KB, so worth one probe and never a second. */
let apiWorks: boolean | null = null;

/** Empty string means the lecture really has no text, which is not the same as a failure. */
export async function fetchLectureBody(
  courseId: CourseId,
  slug: string,
  lessonId: LessonId,
): Promise<string> {
  if (apiWorks !== false) {
    const viaApi = await fromApi(courseId, lessonId).catch(() => null);
    if (viaApi !== null) {
      apiWorks = true;
      return viaApi;
    }
    apiWorks = false;
  }

  return fromPage(slug, lessonId);
}

/** Null distinguishes "this route does not work" from "this lecture has no text". */
async function fromApi(courseId: CourseId, lessonId: LessonId): Promise<string | null> {
  const res = await fetch(api(courseId, lessonId), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REACH_MS),
  });

  if (!res.ok) return null;

  const body: unknown = await res.json();
  const found = attachments(body);
  if (!found) return null;

  const html = found
    .filter((one) => !one.kind || /text|html|markdown/i.test(one.kind))
    .map((one) => one.text ?? one.body ?? one.html ?? '')
    .filter(Boolean)
    .join('\n');

  return markdownFrom(html);
}

/** Which key holds the list is unverified, so try the three plausible ones. */
function attachments(body: unknown): Attachment[] | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const lecture = (root.lecture ?? root) as Record<string, unknown>;

  for (const key of ['attachments', 'lecture_attachments', 'contents']) {
    const found = lecture[key];
    if (Array.isArray(found)) return found as Attachment[];
  }
  return null;
}

async function fromPage(slug: string, lessonId: LessonId): Promise<string> {
  const res = await fetch(lectureUrl(slug, lessonId), {
    credentials: 'include',
    signal: AbortSignal.timeout(REACH_MS),
  });

  if (!res.ok) throw new Error(`Lecture came back ${res.status}.`);

  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const parts = [...doc.querySelectorAll(TEXT)];

  // Signed out this page still renders, minus the body, so an empty parse is ambiguous.
  if (!parts.length && !doc.querySelector('.lecture-content')) {
    throw new Error('That page carried no lecture at all.');
  }

  return tidy(parts.map((part) => walk(part)).join('\n\n'));
}

const markdownFrom = (html: string) =>
  html.trim() ? tidy(walk(new DOMParser().parseFromString(html, 'text/html').body)) : '';

/** Whitespace between their block elements becomes a space, which reads as a blank line. */
const tidy = (md: string) =>
  md
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const BLOCK = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'TABLE', 'TR']);

/** Their markup only: the subset is what they emit, not all of HTML. */
function walk(node: Node, depth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as Element;
  const kids = () => [...el.childNodes].map((kid) => walk(kid, depth)).join('');

  switch (el.tagName) {
    case 'SCRIPT':
    case 'STYLE':
    case 'NOSCRIPT':
      return '';

    case 'BR':
      return '\n';
    case 'HR':
      return '\n\n---\n\n';

    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return `\n\n${'#'.repeat(Number(el.tagName[1]))} ${kids().trim()}\n\n`;

    case 'STRONG':
    case 'B':
      return `**${kids().trim()}**`;
    case 'EM':
    case 'I':
      return `*${kids().trim()}*`;

    case 'CODE':
      // A `code` inside `pre` is the fence's content, not an inline span.
      return el.parentElement?.tagName === 'PRE' ? kids() : `\`${kids().trim()}\``;
    case 'PRE':
      return `\n\n\`\`\`\n${(el.textContent ?? '').trim()}\n\`\`\`\n\n`;

    case 'A': {
      const href = el.getAttribute('href');
      const text = kids().trim();
      return href && text ? `[${text}](${href})` : text;
    }

    case 'IMG': {
      const src = el.getAttribute('src');
      return src ? `\n\n![${el.getAttribute('alt') ?? ''}](${src})\n\n` : '';
    }

    case 'BLOCKQUOTE':
      return `\n\n${kids()
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')}\n\n`;

    case 'UL':
    case 'OL':
      return `\n\n${[...el.children]
        .filter((kid) => kid.tagName === 'LI')
        .map((kid, i) => {
          const mark = el.tagName === 'OL' ? `${i + 1}.` : '-';
          // Its own blank lines would break the item apart, so they collapse first.
          const body = walk(kid, depth + 1)
            .replace(/[ \t]+$/gm, '')
            .replace(/\n{2,}/g, '\n')
            .trim()
            .replace(/\n/g, '\n  ');
          return `${mark} ${body}`;
        })
        .join('\n')}\n\n`;

    case 'LI':
      return kids();

    default:
      return BLOCK.has(el.tagName) ? `\n\n${kids()}\n\n` : kids();
  }
}
