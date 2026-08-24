import { lectureUrl } from '@/lib/lecture';
import type { CourseId, LessonId } from '@/lib/machine';

const ORIGIN = 'https://academy.zerotomastery.io';

/** Their page assembles the player URL from these parts, so no page of theirs holds one. */
const MINT = `${ORIGIN}/api/v2/hotmart/private_video`;

const REACH_MS = 15_000;

/** A render loop once hammered this endpoint until Teachable answered with a reCAPTCHA. */
const MINT_FLOOR_MS = 30_000;

/** A 410 was seen on a signature at ~50 min, so the hold expires well inside that. */
const EMBED_TTL_MS = 20 * 60_000;

/** The manifest lives ~500s, so it is minted at the swap and never held. */
export type Signed = {
  /** A cold frame loads this; its activation and any PiP die with the document. */
  embed: string;
  src: string;
  duration: number | null;
};

export type Ref = { courseId: CourseId; slug: string; lessonId: LessonId };

type Embed = { url: string; duration: number | null; at: number };

/** Keyed by attachment, because the signature is the attachment's, not the lesson's. */
const embeds = new Map<string, Embed>();
const minted = new Map<string, number>();
/** The 790KB lecture page is read once per lesson; its attachment does not move. */
const attachments = new Map<string, string>();

const key = (lesson: Ref) => `${lesson.courseId}:${lesson.lessonId}`;

/** Their API route for the same thing answers 401, so the page is the only source. */
async function attachmentsOn(lesson: Ref): Promise<string[]> {
  const res = await fetch(lectureUrl(lesson.slug, lesson.lessonId), {
    credentials: 'include',
    signal: AbortSignal.timeout(REACH_MS),
  });
  if (!res.ok) throw new Error(`That lecture came back ${res.status}.`);

  const html = await res.text();
  // Teachable serves the paywall with a 200, so the status alone cannot spot it.
  if (/available exclusively for/i.test(html)) {
    throw new Error('That lecture came back paywalled, so the session is gone.');
  }

  const found = [
    ...new Set(
      [...html.matchAll(/attachment[_-]?id["'\s:=]{1,6}(\d{5,})/gi)].flatMap((hit) =>
        hit[1] ? [hit[1]] : [],
      ),
    ),
  ];
  if (!found.length) throw new Error('No attachment on that lecture, so it has no video.');

  // A lecture can carry several; only the video one signs, so the caller tries each.
  return found.slice(0, 3);
}

type MintPayload = {
  video_id?: string;
  signature?: string;
  teachable_application_key?: string;
  duration?: number;
  user_id?: number;
};

async function mint(attachmentId: string, lesson: Ref): Promise<Embed> {
  const since = Date.now() - (minted.get(attachmentId) ?? 0);
  if (since < MINT_FLOOR_MS) {
    throw new Error(`Minted ${Math.round(since / 1000)}s ago; the floor is ${MINT_FLOOR_MS / 1000}s.`);
  }
  minted.set(attachmentId, Date.now());

  const res = await fetch(`${MINT}?attachment_id=${encodeURIComponent(attachmentId)}`, {
    credentials: 'include',
    headers: { accept: 'application/json, text/plain, */*' },
    signal: AbortSignal.timeout(REACH_MS),
  });

  const raw = await res.text();
  if (/recaptcha|challengepage/i.test(raw.slice(0, 500))) {
    throw new Error('Teachable answered with a reCAPTCHA; open the academy in a tab and clear it.');
  }

  let payload: MintPayload;
  try {
    payload = JSON.parse(raw) as MintPayload;
  } catch {
    throw new Error(`Signing came back ${res.status} and not JSON.`);
  }

  const { video_id: videoId, signature, teachable_application_key: token } = payload;
  if (!videoId || !signature || !token) throw new Error(`Signing came back ${res.status} short of parts.`);

  const params = new URLSearchParams({
    signature,
    token,
    metadata: JSON.stringify([
      { key: 'course_id', value: lesson.courseId },
      { key: 'lecture_id', value: lesson.lessonId },
      { key: 'attachment_id', value: attachmentId },
    ]),
  });
  // Only on some payloads, and the player takes it either way.
  if (payload.user_id) params.set('user', String(payload.user_id));

  return {
    url: `https://player.hotmart.com/embed/${videoId}?${params}`,
    duration: payload.duration ?? null,
    at: Date.now(),
  };
}

/** No frame and no API call: the embed document carries its own signed manifest. */
async function manifestIn(embed: string): Promise<string | null> {
  const res = await fetch(embed, { signal: AbortSignal.timeout(REACH_MS) });
  const html = await res.text();

  const src = html.match(/https:\/\/vod-akm\.play\.hotmart\.com\/video\/[^"'\s\\]*hdnts[^"'\s\\]*/)?.[0];
  if (!src) return null;

  // Akamai answers 403 without the application key, and the document's copy omits it.
  const token = new URL(embed).searchParams.get('token');
  return token ? `${src}&app=${token}` : src;
}

async function embedFor(lesson: Ref, force: boolean): Promise<Embed> {
  const known = attachments.get(key(lesson));
  const held = known ? embeds.get(known) : undefined;
  if (!force && held && Date.now() - held.at < EMBED_TTL_MS) return held;

  const failures: string[] = [];
  for (const attachmentId of known ? [known] : await attachmentsOn(lesson)) {
    try {
      const embed = await mint(attachmentId, lesson);
      attachments.set(key(lesson), attachmentId);
      embeds.set(attachmentId, embed);
      return embed;
    } catch (cause) {
      failures.push(cause instanceof Error ? cause.message : String(cause));
    }
  }

  throw new Error(`Nothing on that lecture signed — ${failures.join(' | ')}`);
}

/** Four hops, each with its own expiry; a stale signature is worth exactly one retry. */
export async function sign(lesson: Ref): Promise<Signed> {
  let last = 'The embed document carried no manifest.';

  for (const force of [false, true]) {
    const embed = await embedFor(lesson, force);
    const src = await manifestIn(embed.url).catch((cause: unknown) => {
      last = cause instanceof Error ? cause.message : String(cause);
      return null;
    });
    if (src) return { embed: embed.url, src, duration: embed.duration };

    // A signature that has run out reads exactly like this, so the second pass mints.
    const attachmentId = attachments.get(key(lesson));
    if (attachmentId) minted.delete(attachmentId);
  }

  throw new Error(last);
}
