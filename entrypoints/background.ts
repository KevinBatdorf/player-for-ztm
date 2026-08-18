type Message =
  | { type: 'resolveEmbed'; lectureUrl: string }
  | { type: 'diagnose'; lectureUrl: string }
  | { type: 'listEnrolled' }
  | { type: 'inject'; lectureUrl: string }
  | { type: 'closeInjected' }
  | { type: 'probeMinter' }
  | { type: 'mint'; lesson: Lesson }
  | { type: 'resolveLesson'; lectureUrl: string; courseId?: string }
  | { type: 'resolveManifest'; lectureUrl: string; courseId?: string }
  | { type: 'listLessons'; courseUrl: string }
  | { type: 'reportProgress'; lesson: LessonRef & { seconds: number } };
type Resolved =
  | { ok: true; embedUrl: string }
  | { ok: false; error: string; gated: boolean };
type Enrolled = { ok: true; ids: string[] } | { ok: false; error: string };
type LessonRef = { title: string; attachmentId: string; courseId: string; lectureId: string };
type Embed = { url: string; at: number; duration: number | null };
type Resolution =
  | { ok: true; lesson: LessonRef; embed: Embed }
  | { ok: false; error: string };
type ManifestResolution =
  | { ok: true; lesson: LessonRef; src: string; embed: string; duration: number | null }
  | { ok: false; error: string };
type LessonRow = { url: string; title: string; kind: string; duration: string; courseId: string };
type Listing = { ok: true; rows: LessonRow[] } | { ok: false; error: string };
type Progress = { ok: true; response: string } | { ok: false; error: string };

const toError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// Fetching from the background sends the user's ZTM cookies, so the panel
// never has to open a ZTM tab to reach a signed embed URL.
const resolveEmbed = async (lectureUrl: string): Promise<Resolved> => {
  try {
    const res = await fetch(lectureUrl, { credentials: 'include' });
    const html = await res.text();
    const match = html.match(/https:\/\/player\.hotmart\.com\/embed\/[^"'\s\\]+/);
    if (match) return { ok: true, embedUrl: match[0].replace(/&amp;/g, '&') };

    // Teachable serves the paywall message with a 200, so status can't tell
    // a logged-out fetch apart from a page whose player is injected by JS.
    const gated = /available exclusively for/i.test(html);
    return {
      ok: false,
      gated,
      error: gated
        ? `Not signed in to ZTM in this profile (page came back gated, ${html.length}b).`
        : `Signed in, but no embed in the HTML (${html.length}b) — player is JS-injected.`,
    };
  } catch (error) {
    return { ok: false, gated: false, error: toError(error) };
  }
};

const uniq = (values: string[], limit: number) => [...new Set(values)].slice(0, limit);

// The endpoint Teachable's own page calls to mint the signed player URL. One
// fetch, instead of loading an 800KB lecture page offscreen and scraping the
// iframe it eventually builds.
const MINT = 'https://academy.zerotomastery.io/api/v2/hotmart/private_video';

type MintPayload = {
  video_id?: string;
  signature?: string;
  teachable_application_key?: string;
  duration?: number;
  status?: string;
  user_id?: number;
  [key: string]: unknown;
};

type Lesson = { attachmentId: string; courseId: string; lectureId: string; persist?: boolean };

// The endpoint hands back the parts, not the URL — video id, signature and the
// application key that the player takes as `token`. Teachable's own JS assembles
// them client-side, which is why the lecture HTML never contained a player URL.
// Hard throttle. A render loop in the panel once hammered this endpoint until
// Teachable answered with a reCAPTCHA challenge; no UI bug gets to do that again.
const lastMint = new Map<string, number>();
const MINT_COOLDOWN = 30_000;

const mintEmbed = async (lesson: Lesson) => {
  const previous = lastMint.get(lesson.attachmentId) ?? 0;
  const waited = Date.now() - previous;
  if (waited < MINT_COOLDOWN) {
    return {
      ok: false as const,
      error: `throttled — minted ${Math.round(waited / 1000)}s ago, cooldown ${MINT_COOLDOWN / 1000}s`,
    };
  }
  lastMint.set(lesson.attachmentId, Date.now());

  try {
    const res = await fetch(
      `${MINT}?attachment_id=${encodeURIComponent(lesson.attachmentId)}`,
      { credentials: 'include', headers: { accept: 'application/json, text/plain, */*' } },
    );
    const raw = await res.text();
    if (/recaptcha|challengepage/i.test(raw.slice(0, 500))) {
      return {
        ok: false as const,
        error: 'Teachable returned a reCAPTCHA challenge — open academy.zerotomastery.io in a tab and clear it',
      };
    }
    let payload: MintPayload;
    try {
      payload = JSON.parse(raw) as MintPayload;
    } catch {
      return { ok: false as const, error: `${res.status}, not JSON: ${raw.slice(0, 300)}` };
    }

    const { video_id: videoId, signature, teachable_application_key: token } = payload;
    if (!videoId || !signature || !token) {
      return {
        ok: false as const,
        error: `${res.status}, missing parts. keys: ${Object.keys(payload).join(', ')}`,
      };
    }

    const metadata = JSON.stringify([
      { key: 'course_id', value: lesson.courseId },
      { key: 'lecture_id', value: lesson.lectureId },
      { key: 'attachment_id', value: lesson.attachmentId },
    ]);
    const params = new URLSearchParams({ signature, token, metadata });
    // Present on some payloads and not others, and the player takes it either
    // way, so it is added only when the response actually carries one.
    if (payload.user_id) params.set('user', String(payload.user_id));

    const embedUrl = `https://player.hotmart.com/embed/${videoId}?${params}`;
    const duration = payload.duration ?? null;
    if (lesson.persist === false) return { ok: true as const, embedUrl, duration };
    // Keyed per lesson: more than one card is live at a time, and each needs its
    // own signature.
    await browser.storage.local.set({
      [`embed_${lesson.attachmentId}`]: {
        url: embedUrl,
        at: Date.now(),
        duration,
      },
    });
    return { ok: true as const, embedUrl, duration };
  } catch (error) {
    return { ok: false as const, error: toError(error) };
  }
};

// The embed document carries its own signed manifest, so reading one needs no
// frame and no API call.
const manifestFromEmbed = async (embedUrl: string) => {
  const res = await fetch(embedUrl);
  const html = await res.text();
  const src = html.match(
    /https:\/\/vod-akm\.play\.hotmart\.com\/video\/[^"'\s\\]*hdnts[^"'\s\\]*/,
  )?.[0];
  if (!src) {
    return { ok: false as const, error: `No manifest in the embed document (${html.length}b).` };
  }
  // Akamai answers 403 without the application key, which the document omits.
  const token = new URL(embedUrl).searchParams.get('token');
  return { ok: true as const, src: token ? `${src}&app=${token}` : src };
};

// Throwaway: the signed player URL is built client-side, so this reports what
// the server actually sends in order to locate the endpoint that mints it.
const diagnose = async (lectureUrl: string) => {
  try {
    const res = await fetch(lectureUrl, { credentials: 'include' });
    const html = await res.text();
    const report = {
      bytes: html.length,
      dataAttrs: uniq(
        [...html.matchAll(/data-[\w-]*(?:attachment|video|lecture|media)[\w-]*="[^"]{0,60}"/gi)].map(
          (m) => m[0],
        ),
        12,
      ),
      jsonKeys: uniq(
        [...html.matchAll(/"(\w*(?:video|attachment|media|player|hotmart)\w*)"\s*:/gi)].flatMap(
          (m) => (m[1] ? [m[1]] : []),
        ),
        20,
      ),
      interestingUrls: uniq(
        [...html.matchAll(/https?:\/\/[^"'\s<>]*(?:attachment|video|player|hotmart)[^"'\s<>]*/gi)]
          .map((m) => m[0])
          .filter((u) => !/static-media\.hotmart\.com|\.(png|jpe?g|svg|gif|css)/i.test(u)),
        12,
      ),
      jsonIslands: uniq(
        [...html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>/gi)].map((m) => m[0]),
        8,
      ),
    };
    return { ok: true as const, report: JSON.stringify(report, null, 1) };
  } catch (error) {
    return { ok: false as const, report: toError(error) };
  }
};

const ORIGIN = 'https://academy.zerotomastery.io';
const CURRICULUM_ITEM = /<li class=['"]block__curriculum__section__list__item/;

// Signed in, the course page is a 77KB app shell that renders its lessons in the
// browser. Signed out, the same URL serves the whole curriculum as markup — so
// the catalog is read without the cookies every other call here needs.
const listLessons = async (courseUrl: string): Promise<Listing> => {
  let html: string;
  try {
    const res = await fetch(courseUrl, { credentials: 'omit' });
    html = await res.text();
    if (!res.ok) return { ok: false, error: `Course page came back ${res.status}.` };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }

  const rows = html
    .split(CURRICULUM_ITEM)
    .slice(1)
    .flatMap((item): LessonRow[] => {
      const href = item.match(/href=['"](\/courses\/[^'"]+\/lectures\/\d+)['"]/)?.[1];
      if (!href) return [];
      return [
        {
          url: `${ORIGIN}${href}`,
          title: item.match(/lecture-name['"]>([^<]*)/)?.[1]?.trim() || href,
          kind: item.match(/#icon__(\w+)/)?.[1] ?? '',
          courseId: item.match(/data-ss-course-id=['"](\d+)['"]/)?.[1] ?? '',
          duration: item.match(/lecture-duration['"]>\(([^)]*)\)/)?.[1] ?? '',
        },
      ];
    });

  if (!rows.length) {
    return { ok: false, error: `No curriculum in that page (${html.length}b).` };
  }
  return { ok: true, rows };
};

// Signed in, the lecture page is an app shell with no csrf meta. Rails renders
// the meta into whichever pages are still server-side, so the token is hunted
// across them rather than assumed to sit on the lesson's own page.
const csrfToken = async (lecture: string) => {
  const cookie = await browser.cookies.get({ url: ORIGIN, name: 'admin_csrf_token' });
  if (cookie?.value) return { token: decodeURIComponent(cookie.value), from: 'cookie' };

  const notes: string[] = [];
  for (const url of [lecture, `${ORIGIN}/courses/enrolled`, `${ORIGIN}/`]) {
    const where = url.replace(ORIGIN, '') || '/';
    try {
      const res = await fetch(url, { credentials: 'include' });
      const html = await res.text();
      const meta = html.match(/<meta[^>]*csrf-token[^>]*>/i)?.[0];
      const token = meta?.match(/content=["']([^"']+)["']/i)?.[1];
      // A guest page carries a csrf token too, and its token cannot post as the
      // user — so the page has to prove it was rendered for a signed-in session.
      const signedIn = /sign_out|signout/i.test(html);
      if (token) return { token, from: `${where} ${html.length}b signedIn=${signedIn}` };
      notes.push(
        `${where} ${res.status} ${html.length}b html=${/<html/i.test(html)} csrf=${/csrf/i.test(html)}`,
      );
    } catch (error) {
      notes.push(`${where} ERR ${toError(error)}`);
    }
  }
  return { token: '', from: notes.join(' | ') };
};

// What Teachable's own player posts as a video plays. Watching through our
// embed bypasses the page that would send it, so nothing is recorded otherwise.
const reportProgress = async (lesson: LessonRef & { seconds: number }): Promise<Progress> => {
  const lecture = `${ORIGIN}/courses/${lesson.courseId}/lectures/${lesson.lectureId}`;
  try {
    const { token, from } = await csrfToken(lecture);
    if (!token) return { ok: false, error: `No CSRF token. Cookies present: ${from}` };

    const res = await fetch(`${lecture}/attachment_completions.json`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': token,
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json, text/javascript, */*; q=0.01',
      },
      body: JSON.stringify({
        attachment_id: lesson.attachmentId,
        timestamp_data: [[0, Math.round(lesson.seconds)]],
      }),
    });

    // Watching the video and completing the lesson are separate records, and
    // only the second one puts a tick next to it in the curriculum.
    const done = await fetch(`${lecture}/complete`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-csrf-token': token,
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json, text/javascript, */*; q=0.01',
      },
      body: '',
    });

    return {
      ok: true,
      response: `watched ${res.status}, complete ${done.status} (token from ${from}) ${(
        await done.text()
      ).slice(0, 200)}`,
    };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
};

const resolveLesson = async (lectureUrl: string, known?: string): Promise<Resolution> => {
  const lectureId = lectureUrl.match(/\/lectures\/(\d+)/)?.[1];
  if (!lectureId) {
    return { ok: false, error: 'Expected a URL like /courses/<slug>/lectures/<id>.' };
  }

  let html: string;
  try {
    const res = await fetch(lectureUrl, { credentials: 'include' });
    html = await res.text();
    if (!res.ok) return { ok: false, error: `Lecture page came back ${res.status}.` };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }

  // Teachable serves the paywall with a 200, so status alone can't spot it.
  if (/available exclusively for/i.test(html)) {
    return { ok: false, error: 'Not signed in to ZTM in this Chrome profile.' };
  }

  const attachmentIds = uniq(
    [...html.matchAll(/attachment[_-]?id["\'\s:=]{1,6}(\d{5,})/gi)].flatMap((m) =>
      m[1] ? [m[1]] : [],
    ),
    3,
  );
  if (!attachmentIds.length) {
    return { ok: false, error: 'No attachment on this lecture — a text-only lesson has no video.' };
  }

  const courseId = known || html.match(/"course_id"\s*:\s*"?(\d+)/)?.[1] || '';
  const title =
    html.match(/<title>([^<]*)<\/title>/i)?.[1]?.split('|')[0]?.trim() || `Lecture ${lectureId}`;

  // A lecture can carry several attachments; only the video one signs.
  const failures: string[] = [];
  for (const attachmentId of attachmentIds) {
    const minted = await mintEmbed({ attachmentId, courseId, lectureId });
    if (minted.ok) {
      return {
        ok: true,
        lesson: { title, attachmentId, courseId, lectureId },
        embed: { url: minted.embedUrl, at: Date.now(), duration: minted.duration },
      };
    }
    failures.push(`${attachmentId}: ${minted.error}`);
  }
  return { ok: false, error: `Nothing playable here — ${failures.join(' | ')}` };
};

const resolveManifest = async (
  lectureUrl: string,
  courseId?: string,
): Promise<ManifestResolution> => {
  const resolved = await resolveLesson(lectureUrl, courseId);
  if (!resolved.ok) return resolved;
  const manifest = await manifestFromEmbed(resolved.embed.url);
  if (!manifest.ok) return manifest;
  return {
    ok: true,
    lesson: resolved.lesson,
    src: manifest.src,
    embed: resolved.embed.url,
    duration: resolved.embed.duration,
  };
};

const listEnrolled = async (): Promise<Enrolled> => {
  try {
    const res = await fetch('https://academy.zerotomastery.io/courses/enrolled', {
      credentials: 'include',
    });
    const html = await res.text();
    const ids = [...html.matchAll(/\/courses\/enrolled\/(\d+)/g)].flatMap((m) =>
      m[1] ? [m[1]] : [],
    );
    return { ok: true, ids: [...new Set(ids)] };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
};

// buildModal is serialized into the page, so it can't close over the imported
// `browser`; `chrome` is what exists on the other side.
declare const chrome: {
  storage: { local: { set: (items: Record<string, unknown>) => void } };
};

// Runs in the page's isolated world, so the iframe it creates is exempt from
// that page's CSP — see PIP-FINDINGS.
const buildModal = (url: string) => {
  document.getElementById('ztm-modal')?.remove();

  const host = document.createElement('div');
  host.id = 'ztm-modal';
  host.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:rgb(0 0 0 / 0.65);display:flex;align-items:center;justify-content:center';

  const frame = document.createElement('iframe');
  frame.src = url;
  frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
  frame.style.cssText =
    'width:min(920px,92vw);height:min(580px,82vh);border:0;border-radius:12px;background:#000';

  const close = document.createElement('button');
  close.textContent = 'Close';
  close.style.cssText =
    'position:absolute;top:18px;right:18px;padding:8px 16px;font:600 14px system-ui,sans-serif;cursor:pointer;border-radius:8px;border:0';
  close.addEventListener('click', () => {
    host.remove();
    // Clearing the heartbeat directly, rather than letting it lapse, is what
    // makes the card update the moment this closes.
    chrome.storage.local.set({ injected: false, pageBeat: 0 });
  });

  host.append(frame, close);
  document.documentElement.appendChild(host);
  chrome.storage.local.set({ injected: true });
};

const activeTabId = async () => {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
};

const inject = async (lectureUrl: string) => {
  const tabId = await activeTabId();
  if (!tabId) return { ok: false as const, error: 'No active tab.' };
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      args: [lectureUrl],
      func: buildModal,
    });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toError(error) };
  }
};

const closeInjected = async () => {
  const tabId = await activeTabId();
  if (!tabId) return { ok: false as const, error: 'No active tab.' };
  await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      document.getElementById('ztm-modal')?.remove();
      chrome.storage.local.set({ injected: false, pageBeat: 0 });
    },
  });
  return { ok: true as const };
};

// Watching from here rather than from the page: the harvest frame is torn down
// as soon as it yields the embed URL, which is usually before a timer inside it
// gets to report anything.
const seen = new Set<string>();

const noteRequest = (url: string) => {
  if (seen.has(url) || seen.size > 60) return;
  seen.add(url);
  browser.storage.local.set({ apiCalls: [...seen] });
};

// The endpoint that mints the signed player URL is whichever one answers with a
// player.hotmart.com/embed link. Replaying each candidate is the cheapest way to
// find out which.
const probeMinter = async () => {
  const results: string[] = [];
  for (const url of seen) {
    try {
      const res = await fetch(url, { credentials: 'include', headers: { accept: '*/*' } });
      const body = (await res.text()).slice(0, 400_000);
      const embed = body.match(/https:\/\/player\.hotmart\.com\/embed\/[^"'\s\\]+/);
      results.push(`${res.status} ${embed ? 'MINTS EMBED' : 'no embed'} ${url}`);
      if (embed) results.push(`   -> ${embed[0].slice(0, 120)}…`);
    } catch (error) {
      results.push(`ERR ${toError(error)} ${url}`);
    }
  }
  results.sort((a, b) => Number(b.includes('MINTS')) - Number(a.includes('MINTS')));
  await browser.storage.local.set({ minterProbe: results });
  return { ok: true as const, count: results.length };
};

export default defineBackground(() => {
  browser.webRequest.onCompleted.addListener(
    (details) => noteRequest(details.url),
    {
      urls: ['https://academy.zerotomastery.io/*'],
      types: ['xmlhttprequest'],
    },
  );

  // Disabled by default so the panel doesn't ride along on every tab; the
  // action handler turns it on for just the tab it was opened from.
  browser.sidePanel.setOptions({ enabled: false });

  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    await browser.sidePanel.setOptions({
      tabId: tab.id,
      path: 'sidepanel.html',
      enabled: true,
    });
    await browser.sidePanel.open({ tabId: tab.id });
  });

  // The card's buttons live inside the player frame, which can't reach the
  // tabs API, so it asks for the injection through storage instead.
  browser.storage.onChanged.addListener(async (changes) => {
    const request = changes.injectReq?.newValue as { url?: string } | undefined;
    if (request?.url) await inject(request.url);
  });

  browser.runtime.onMessage.addListener(
    (msg: Message, _sender, sendResponse: (res: unknown) => void) => {
      if (msg.type === 'resolveEmbed') {
        resolveEmbed(msg.lectureUrl).then(sendResponse);
        return true;
      }
      if (msg.type === 'diagnose') {
        diagnose(msg.lectureUrl).then(sendResponse);
        return true;
      }
      if (msg.type === 'listEnrolled') {
        listEnrolled().then(sendResponse);
        return true;
      }
      if (msg.type === 'inject') {
        inject(msg.lectureUrl).then(sendResponse);
        return true;
      }
      if (msg.type === 'closeInjected') {
        closeInjected().then(sendResponse);
        return true;
      }
      if (msg.type === 'probeMinter') {
        probeMinter().then(sendResponse);
        return true;
      }
      if (msg.type === 'mint') {
        mintEmbed(msg.lesson).then(sendResponse);
        return true;
      }
      if (msg.type === 'resolveLesson') {
        resolveLesson(msg.lectureUrl, msg.courseId).then(sendResponse);
        return true;
      }
      if (msg.type === 'resolveManifest') {
        resolveManifest(msg.lectureUrl, msg.courseId).then(sendResponse);
        return true;
      }
      if (msg.type === 'reportProgress') {
        reportProgress(msg.lesson).then(sendResponse);
        return true;
      }
      if (msg.type === 'listLessons') {
        listLessons(msg.courseUrl).then(sendResponse);
        return true;
      }
    },
  );
});
