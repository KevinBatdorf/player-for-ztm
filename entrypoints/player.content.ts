import { lessonInHash, type FromFrame, type Swap, type ToFrame } from '@/lib/frame';

/**
 * The player is a page object an isolated world cannot see, and Picture-in-Picture can only
 * be requested by the document that owns the video — so the controls are built in here.
 */
export default defineContentScript({
  matches: ['https://player.hotmart.com/*'],
  allFrames: true,
  world: 'MAIN',
  // The autoplay guard has to be in place before their scripts build the player.
  runAt: 'document_start',
  main() {
    type Player = { src: (source: { src: string; type: string }) => void };
    type PlayerElement = HTMLElement & { player?: Player };

    const HLS = 'application/x-mpegURL';
    const TICK_MS = 1000;
    /** A source that never loads would leave the panel saying it is still loading. */
    const SWAP_MS = 10_000;

    let lesson = lessonInHash(location.hash);
    let video: HTMLVideoElement | null = null;
    // The embed calls play() on load; nothing plays until a button in here asks for it.
    let wanted = false;
    let started = false;

    const post = (message: FromFrame) => parent.postMessage(message, '*');

    const SVG = 'http://www.w3.org/2000/svg';

    /** Trusted Types on their page would refuse innerHTML. */
    const shape = (name: string, attributes: Record<string, string>) => {
      const node = document.createElementNS(SVG, name);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      return node;
    };

    const icon = (...parts: Element[]) => {
      const svg = shape('svg', {
        viewBox: '0 0 24 24',
        width: '13',
        height: '13',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      svg.append(...parts);
      return svg;
    };

    const overlay = document.createElement('div');
    const corner = document.createElement('div');
    // The panel's stylesheet does not reach this document, so the silver button is hand-rolled.
    const ring = document.createElement('div');
    const pill = document.createElement('div');
    const divider = document.createElement('span');
    const play = document.createElement('button');
    const popOut = document.createElement('button');

    const TAP = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'width:30px',
      'height:24px',
      'padding:0',
      'border:0',
      'border-radius:6px',
      'background:transparent',
      'color:#e6e8eb',
      'cursor:pointer',
      'transition:background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    ].join(';');

    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgb(10 11 13 / 0.55)';
    corner.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483647';
    ring.style.cssText = [
      'display:inline-block',
      'padding:1px',
      'border-radius:11px',
      // The panel's ring is a masked gradient; this document gets a padded one instead.
      'background:radial-gradient(130% 130% at 100% 100%, rgb(230 232 235 / 0.5), rgb(155 161 172 / 0.05) 55%)',
      'box-shadow:0 1px 2px 0 rgb(0 0 0 / 0.4)',
    ].join(';');
    pill.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:2px',
      'padding:3px',
      'border-radius:10px',
      'background:linear-gradient(to bottom, #16181d, #101216)',
    ].join(';');
    divider.style.cssText = 'width:1px;height:14px;background:#2a2e37';
    play.style.cssText = TAP;
    popOut.style.cssText = TAP;
    play.setAttribute('aria-label', 'Play');
    popOut.setAttribute('aria-label', 'Pop out');
    play.append(icon(shape('polygon', { points: '7 4 20 12 7 20 7 4', fill: 'currentColor' })));
    popOut.append(
      icon(
        shape('path', { d: 'M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4' }),
        shape('rect', { width: '10', height: '7', x: '12', y: '13', rx: '2' }),
      ),
    );
    pill.append(play, divider, popOut);
    ring.append(pill);

    for (const tap of [play, popOut]) {
      tap.addEventListener('pointerenter', () => tap.style.setProperty('background', '#1e2127'));
      tap.addEventListener('pointerleave', () => tap.style.setProperty('background', 'transparent'));
    }

    /** Once it plays the native bar takes over, so only popping out is left. */
    const paint = () => {
      const home = started ? corner : overlay;
      if (ring.parentElement !== home) home.append(ring);
      play.style.display = started ? 'none' : 'inline-flex';
      divider.style.display = started ? 'none' : 'block';
      overlay.style.display = started ? 'none' : 'flex';
      corner.style.display = started && !document.pictureInPictureElement ? 'block' : 'none';
    };

    /** Unmuted playback rides sticky activation, so the first real click covers the session. */
    const start = async (): Promise<boolean> => {
      if (!video) return false;
      wanted = true;
      video.muted = false;
      try {
        await video.play();
        return true;
      } catch {
        // A frame nobody has played holds on the first frame rather than reporting a fault.
        return false;
      }
    };

    play.addEventListener('click', () => void start());

    popOut.addEventListener('click', () => {
      if (!video) return;
      // Synchronous: Picture-in-Picture needs the gesture, which an await would spend.
      const opening = video.requestPictureInPicture();
      void start();
      opening.catch((cause: unknown) =>
        post({ ztm: 'failed', lessonId: lesson, message: `Pop out refused: ${String(cause)}` }),
      );
    });

    const covered = (playing: HTMLVideoElement) => {
      let total = 0;
      for (let i = 0; i < playing.played.length; i++) {
        total += playing.played.end(i) - playing.played.start(i);
      }
      return +total.toFixed(1);
    };

    /** Their markup cannot be unwrapped, only collapsed: every sibling on the path goes. */
    const strip = () => {
      if (!video) return;
      for (let node: HTMLElement = video; node.parentElement; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling !== node && sibling !== overlay && sibling !== corner) {
            (sibling as HTMLElement).style.setProperty('display', 'none');
          }
        }
        if (node !== video) {
          node.style.setProperty('width', '100%');
          node.style.setProperty('height', '100%');
          node.style.setProperty('max-width', 'none');
          node.style.setProperty('max-height', 'none');
        }
      }
      document.body.style.setProperty('margin', '0');
      document.body.style.setProperty('overflow', 'hidden');
      document.documentElement.style.setProperty('background', '#000');
      video.style.setProperty('width', '100%');
      video.style.setProperty('height', '100%');
      video.style.setProperty('object-fit', 'contain');
      document.documentElement.append(overlay, corner);
    };

    const attach = () => {
      const found = document.querySelector('video');
      if (!found || found === video) return;
      video = found;
      video.controls = started;
      // It may have started before this script ran.
      if (!wanted && !started && !video.paused) video.pause();

      video.addEventListener('play', () => {
        if (!wanted && !started) {
          video?.pause();
          return;
        }
        started = true;
        // Theirs is stripped, so the native bar is the only way to scrub.
        if (video) video.controls = true;
        paint();
        post({ ztm: 'playing', lessonId: lesson });
      });
      video.addEventListener('pause', () => post({ ztm: 'paused', lessonId: lesson }));
      video.addEventListener('ended', () => post({ ztm: 'ended', lessonId: lesson }));
      video.addEventListener('enterpictureinpicture', paint);
      video.addEventListener('leavepictureinpicture', paint);

      strip();
      paint();
      post({ ztm: 'ready', lessonId: lesson });
    };

    /** Handing the running player a new source is what keeps the document, and with it PiP. */
    const swap = (request: Swap) => {
      const player = (document.querySelector('.video-js') as PlayerElement | null)?.player;
      if (!player || !video) {
        post({ ztm: 'failed', lessonId: request.lessonId, message: 'No player in this frame.' });
        return;
      }

      lesson = request.lessonId;
      wanted = request.play;
      // A lesson picked while paused arrives paused, so its overlay has to come back.
      started = request.play;

      const giveUp = setTimeout(() => {
        post({ ztm: 'failed', lessonId: lesson, message: 'That lesson never loaded.' });
      }, SWAP_MS);

      // src() reloads the tech asynchronously; playing sooner resolves against the outgoing video.
      video.addEventListener(
        'loadedmetadata',
        () => {
          clearTimeout(giveUp);
          if (!request.play) {
            if (video) video.controls = false;
            paint();
            post({ ztm: 'ready', lessonId: lesson });
            return;
          }
          void start().then(() => post({ ztm: 'ready', lessonId: lesson }));
        },
        { once: true },
      );

      player.src({ src: request.src, type: HLS });
    };

    addEventListener('message', (event: MessageEvent) => {
      if (event.source !== parent || parent === window) return;
      const request = event.data as ToFrame | undefined;
      if (request?.ztm === 'swap') swap(request);
      // A popped-out video is still on screen, so it keeps playing.
      if (request?.ztm === 'pause' && !document.pictureInPictureElement) video?.pause();
    });

    attach();
    new MutationObserver(attach).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    setInterval(() => {
      if (!video || video.paused) return;
      post({
        ztm: 'progress',
        lessonId: lesson,
        covered: covered(video),
        duration: Number.isFinite(video.duration) ? +video.duration.toFixed(1) : null,
      });
    }, TICK_MS);
  },
});
