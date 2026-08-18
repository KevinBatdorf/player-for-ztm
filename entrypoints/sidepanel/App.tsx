import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { SwapResult } from '@/lib/player-state';

const LECTURE_ALLOW = 'autoplay; fullscreen; picture-in-picture';

const DEFAULT_TARGET = 'https://academy.zerotomastery.io/courses/enrolled/694968';

type Lesson = { title: string; attachmentId: string; courseId: string; lectureId: string };
type Embed = { url: string; at: number; duration: number | null };
type Resolution =
  | { ok: true; lesson: Lesson; embed: Embed }
  | { ok: false; error: string };
type ManifestResolution =
  | { ok: true; lesson: Lesson; src: string; embed: string; duration: number | null }
  | { ok: false; error: string };
type LessonRow = { url: string; title: string; kind: string; duration: string; courseId: string };
type Listing = { ok: true; rows: LessonRow[] } | { ok: false; error: string };

// What the frame was signed for, which is not what it plays after a swap.
type Frame = { url: string; lessonId: string };
type Playing = { lesson: Lesson; duration: number | null };

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const Card = ({ frame, playing }: { frame: Frame; playing: Playing }) => {
  const [mountedAt] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState('');

  const readyKey = `ready_${frame.lessonId}`;

  useEffect(() => {
    // A flag left by an earlier load of the same lesson would drop the still
    // before this frame has painted anything.
    const read = (stored: Record<string, unknown>) =>
      setReady(((stored[readyKey] as number) ?? 0) >= mountedAt);

    browser.storage.local.get(readyKey).then(read);
    const onChanged = () => browser.storage.local.get(readyKey).then(read);
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, [readyKey, mountedAt]);

  // Ranges rather than a single position: Teachable decides completion from
  // what was actually watched.
  const markWatched = async () => {
    const { playerTick } = await browser.storage.local.get('playerTick');
    const tick = playerTick as { lesson?: string; played?: [number, number][] } | undefined;
    const watched =
      tick?.lesson === playing.lesson.attachmentId
        ? Math.max(0, ...(tick.played ?? []).map(([, end]) => end))
        : 0;
    const seconds = watched || (playing.duration ?? 0);
    setProgress('Reporting…');
    const res = (await browser.runtime.sendMessage({
      type: 'reportProgress',
      lesson: { ...playing.lesson, seconds },
    })) as { ok: boolean; response?: string; error?: string } | undefined;
    setProgress(res?.ok ? `sent ${Math.round(seconds)}s — ${res.response}` : (res?.error ?? 'failed'));
  };

  return (
    <div className="card">
      <div className="card-video">
        <div className={ready ? 'still gone' : 'still'}>
          <span className="spinner" role="status" aria-label="Loading lesson" />
        </div>
        <iframe
          src={`${frame.url}#ztm-card:${frame.lessonId}`}
          allow={LECTURE_ALLOW}
          allowFullScreen
        />
      </div>
      <div className="card-body">
        <strong>{playing.lesson.title}</strong>
        <div className="readout-line">
          <span>{playing.duration ? clock(playing.duration) : '—'}</span>
          <span className="lesson-meta">
            lecture {playing.lesson.lectureId} · attachment {playing.lesson.attachmentId}
          </span>
        <button type="button" className="secondary" onClick={markWatched}>
          Mark watched on ZTM
        </button>
        {progress && <div className="report">{progress}</div>}
        </div>
      </div>
    </div>
  );
};

export const App = () => {
  const [url, setUrl] = useState(DEFAULT_TARGET);
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState('');
  const [swapped, setSwapped] = useState('');

  useEffect(() => {
    const read = () =>
      browser.storage.local.get('swapResult').then((stored) => {
        const result = stored.swapResult as SwapResult | undefined;
        if (!result) return setSwapped('');
        if (result.error) return setSwapped(`swap failed — ${result.error}`);
        setSwapped(result.playing ? 'swapped in place' : 'swapped, waiting for play');
      });
    read();
    browser.storage.onChanged.addListener(read);
    return () => browser.storage.onChanged.removeListener(read);
  }, []);

  const mount = async (lectureUrl: string, courseId?: string) => {
    setBusy(true);
    setAt(lectureUrl);
    setStatus('Signing the player…');
    const res = (await browser.runtime.sendMessage({
      type: 'resolveLesson',
      lectureUrl,
      courseId,
    })) as Resolution | undefined;
    setBusy(false);
    if (!res?.ok) {
      setStatus(res?.error ?? 'The background worker did not answer.');
      return;
    }
    setStatus('');
    setFrame({ url: res.embed.url, lessonId: res.lesson.attachmentId });
    setPlaying({ lesson: res.lesson, duration: res.embed.duration });
  };

  const swap = async (lectureUrl: string, courseId?: string) => {
    setBusy(true);
    setStatus('Signing the next lesson…');
    const res = (await browser.runtime.sendMessage({
      type: 'resolveManifest',
      lectureUrl,
      courseId,
    })) as ManifestResolution | undefined;
    setBusy(false);
    if (!res?.ok) {
      setStatus(res?.error ?? 'The background worker did not answer.');
      return;
    }
    setStatus('');
    setAt(lectureUrl);
    setPlaying({ lesson: res.lesson, duration: res.duration });
    browser.storage.local.set({
      swapReq: {
        at: Date.now(),
        lesson: res.lesson.attachmentId,
        src: res.src,
        embed: res.embed,
        duration: res.duration,
      },
    });
  };

  // Only the first lesson gets a frame; swapping keeps the one holding the popout.
  const go = (lectureUrl: string, courseId?: string) =>
    frame ? swap(lectureUrl, courseId) : mount(lectureUrl, courseId);

  // A text lesson has no attachment to sign, so it is skipped rather than
  // failing when a finished video hands over to it.
  const nextRow = () => {
    const index = rows.findIndex((row) => row.url === at);
    return index < 0 ? undefined : rows.slice(index + 1).find((row) => row.kind === 'Video');
  };

  const advance = () => {
    const next = nextRow();
    if (!next) {
      setStatus('No further video lesson in this course.');
      return;
    }
    go(next.url, next.courseId);
  };

  useEffect(() => {
    const onChanged = (changes: Record<string, { newValue?: unknown }>) => {
      const ended = changes.lessonEnded?.newValue as { lesson?: string } | undefined;
      if (!ended || !playing || ended.lesson !== playing.lesson.attachmentId) return;
      setStatus('Lesson ended — advancing.');
      advance();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  });

  // Seeking works from outside the frame with no gesture, so the end of a
  // lesson is reachable in one click instead of one runtime.
  const skipToEnd = () => {
    const end = playing?.duration;
    if (!end) {
      setStatus('No duration known for this lesson yet.');
      return;
    }
    setStatus(`Seeking to ${Math.round(end - 5)}s of ${Math.round(end)}s…`);
    browser.storage.local.set({ seekReq: { t: Math.max(0, end - 5), at: Date.now() } });
  };

  const load = async () => {
    const target = url.trim();
    if (/\/lectures\/\d+/.test(target)) {
      setRows([]);
      await go(target);
      return;
    }
    setBusy(true);
    setFrame(null);
    setPlaying(null);
    setRows([]);
    setStatus('Reading the course…');
    const res = (await browser.runtime.sendMessage({
      type: 'listLessons',
      courseUrl: target,
    })) as Listing | undefined;
    setBusy(false);
    if (!res?.ok) {
      setStatus(res?.error ?? 'The background worker did not answer.');
      return;
    }
    setStatus(`${res.rows.length} lessons — pick one to play.`);
    setRows(res.rows);
  };

  return (
    <div className="wrap">
      <form
        className="loader"
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
      >
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="ZTM course or lecture URL"
          spellCheck={false}
        />
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Loading…' : 'Load'}
        </button>
      </form>
      {status && <div className="report">{status}</div>}
      {frame && playing && (
        <>
          <Card key={frame.url} frame={frame} playing={playing} />
          <div className="modes">
            <button type="button" className="secondary" onClick={skipToEnd} disabled={busy}>
              Skip to end
            </button>
            <button
              type="button"
              className="secondary"
              onClick={advance}
              disabled={busy || !nextRow()}
            >
              Next lesson
            </button>
          </div>
          {swapped && <div className="report">{swapped}</div>}
        </>
      )}
      <ul className="lessons">
        {rows.map((row) => (
          <li key={row.url}>
            <button
              type="button"
              className="lesson"
              aria-current={row.url === at}
              onClick={() => go(row.url, row.courseId)}
              disabled={busy || row.kind !== 'Video'}
            >
              <span>{row.title}</span>
              <span className="lesson-meta">
                {[row.kind, row.duration].filter(Boolean).join(' · ') || '—'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
