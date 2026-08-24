import { lessonInHash, type FromFrame, type ToFrame } from '@/lib/frame';

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

    const overlay = document.createElement('div');
    const corner = document.createElement('div');
    const play = document.createElement('button');
    const popOut = document.createElement('button');

    const BUTTON = [
      'font:500 13px/1 Inter, ui-sans-serif, system-ui, sans-serif',
      'color:#0a0b0d',
      'background:#c792ea',
      'border:0',
      'border-radius:8px',
      'padding:9px 16px',
      'cursor:pointer',
      'box-shadow:0 1px 2px 0 rgb(0 0 0 / 0.4)',
    ].join(';');

    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgb(10 11 13 / 0.55)';
    corner.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483647';
    play.style.cssText = BUTTON;
    popOut.style.cssText = `${BUTTON};padding:5px 10px;font-size:11px;background:rgb(10 11 13 / 0.72);color:#e6e8eb`;
    play.textContent = 'Play';
    popOut.textContent = 'Pop out';
    overlay.append(play);
    corner.append(popOut);

    const paint = () => {
      overlay.style.display = started ? 'none' : 'flex';
      corner.style.display = document.pictureInPictureElement ? 'none' : 'block';
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
      video.addEventListener('ended', () => post({ ztm: 'ended', lessonId: lesson }));
      video.addEventListener('enterpictureinpicture', paint);
      video.addEventListener('leavepictureinpicture', paint);

      strip();
      paint();
      post({ ztm: 'ready', lessonId: lesson });
    };

    /** Handing the running player a new source is what keeps the document, and with it PiP. */
    const swap = (request: ToFrame) => {
      const player = (document.querySelector('.video-js') as PlayerElement | null)?.player;
      if (!player || !video) {
        post({ ztm: 'failed', lessonId: request.lessonId, message: 'No player in this frame.' });
        return;
      }

      lesson = request.lessonId;
      wanted = true;

      const giveUp = setTimeout(() => {
        post({ ztm: 'failed', lessonId: lesson, message: 'That lesson never loaded.' });
      }, SWAP_MS);

      // src() reloads the tech asynchronously; playing sooner resolves against the outgoing video.
      video.addEventListener(
        'loadedmetadata',
        () => {
          clearTimeout(giveUp);
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
