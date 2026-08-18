import type { PlayerTick, SeekRequest, SwapRequest, SwapResult } from '@/lib/player-state';

const ranges = (tr: TimeRanges) =>
  Array.from({ length: tr.length }, (_, i): [number, number] => [
    +tr.start(i).toFixed(2),
    +tr.end(i).toFixed(2),
  ]);

// More than one copy of the same lecture can be live at once — the card in the
// panel and the one injected into the page. They share a single store, so one
// owns it and the rest follow, or they overwrite each other's ticks.
const INSTANCE = crypto.randomUUID();
const DRIFT = 0.75;

// The card is a still with the controls on it; the injected copy is just a
// player and carries no UI of ours at all.
const CARD = location.hash.includes('ztm-card');
// Every copy of a lesson tags itself, so one lesson's position is never applied
// to another's video.
const LESSON = location.hash.match(/ztm-(?:card|page):([\w-]+)/)?.[1] ?? '';
const CARD_ID = LESSON || 'card';
const IN_PAGE = location.hash.includes('ztm-page');

const BUTTON = [
  'padding:8px 14px',
  'font:600 13px/1 system-ui, sans-serif',
  'color:#fff',
  'cursor:pointer',
  'background:#4f46e5',
  'border:0',
  'border-radius:999px',
  'box-shadow:0 2px 10px rgb(0 0 0 / 0.4)',
].join(';');

export default defineContentScript({
  matches: ['https://player.hotmart.com/*'],
  allFrames: true,
  main() {
    let video: HTMLVideoElement | null = null;
    // The hash and address only say which lesson the frame started on.
    let lesson = LESSON;
    let embedUrl = location.href.split('#')[0] ?? '';
    let owner: string | null = null;
    let wanted = IN_PAGE;
    let pinned = CARD;
    let pipOpen = false;
    // Liveness, not a flag: a stored boolean survives the thing it describes,
    // so the in-page copy has to keep saying it is still there.
    let pageBeat = 0;
    // Set optimistically the moment the button is pressed: the injected copy
    // takes a second or two to exist, and the card shouldn't look asleep.
    let pageStarting = 0;
    const pageAlive = () =>
      (pageBeat > 0 && Date.now() - pageBeat < 1200) || Date.now() - pageStarting < 15000;

    const owns = () => owner === INSTANCE;

    // Their player restores a remembered speed after load, so this has to be
    // re-asserted rather than set once.
    const RATE = 1;

    const claim = () => {
      if (owns()) return;
      owner = INSTANCE;
      browser.storage.local.set({ owner: INSTANCE });
    };

    const report = () => {
      if (!video || !owns()) return;
      const tick: PlayerTick = {
        at: Date.now(),
        instanceId: INSTANCE,
        lesson,
        currentTime: +video.currentTime.toFixed(2),
        duration: Number.isFinite(video.duration) ? +video.duration.toFixed(2) : null,
        paused: video.paused,
        rate: video.playbackRate,
        played: ranges(video.played),
        mediaSrc: video.currentSrc || null,
        manifests: [],
      };
      browser.storage.local.set({ playerTick: tick });
    };

    // Taking over mid-lesson means picking up where the other copy left off.
    const resumeFromStore = async () => {
      const { playerTick } = await browser.storage.local.get('playerTick');
      const last = playerTick as PlayerTick | undefined;
      if (!video || !last || last.instanceId === INSTANCE) return;
      if (last.lesson !== lesson) return;
      if (Math.abs(video.currentTime - last.currentTime) > DRIFT) {
        video.currentTime = last.currentTime;
      }
    };

    const play = () => {
      if (!video) return;
      wanted = true;
      pinned = false;
      claim();
      resumeFromStore().then(() => {
        if (!video) return;
        video.muted = false;
        video.play().catch(() => {
          if (!video) return;
          video.muted = true;
          video.play().catch(() => {});
        });
      });
    };

    // ---- the card's own UI -------------------------------------------------

    const overlay = document.createElement('div');
    const message = document.createElement('p');
    const buttons = document.createElement('div');
    const playHere = document.createElement('button');
    const playInPage = document.createElement('button');
    const popOut = document.createElement('button');

    if (CARD) {
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483647',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'gap:12px',
        'font:14px/1.4 system-ui, sans-serif',
        'color:#fff',
        'text-align:center',
      ].join(';');
      message.style.cssText = 'margin:0;text-shadow:0 1px 6px rgb(0 0 0 / 0.8)';
      buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center';

      playHere.textContent = 'Play here';
      playInPage.textContent = 'Play in browser';
      popOut.textContent = 'Pop out';
      for (const button of [playHere, playInPage, popOut]) {
        button.style.cssText = BUTTON;
        buttons.appendChild(button);
      }
      overlay.append(message, buttons);

      playHere.addEventListener('click', play);
      playInPage.addEventListener('click', () => {
        pageStarting = Date.now();
        render();
        browser.storage.local.set({
          injectReq: { at: Date.now(), url: `${embedUrl}#ztm-page:${lesson}` },
        });
      });
      popOut.addEventListener('click', () => {
        if (!video) return;
        // Synchronous, or the gesture is gone by the time it runs.
        const request = video.requestPictureInPicture();
        play();
        request.catch((error: unknown) =>
          browser.storage.local.set({ pipError: { message: String(error), at: Date.now() } }),
        );
      });
    }

    const render = () => {
      if (!CARD) return;
      const playingHere = !!video && !video.paused && !pinned && !pipOpen;
      const elsewhere = pipOpen ? 'Video is playing in popout' : pageAlive() ? 'Video is playing in browser' : '';

      message.textContent = elsewhere;
      // The card is not the picture while the browser copy is: black it out
      // the way PiP blacks out a video it has taken over.
      overlay.style.background = pageAlive()
        ? '#000'
        : playingHere
          ? 'transparent'
          : 'rgb(0 0 0 / 0.55)';
      overlay.style.pointerEvents = playingHere ? 'none' : 'auto';
      // The buttons are for starting something. Once something is running,
      // wherever it is, they are just clutter over the picture.
      buttons.style.display = playingHere || elsewhere ? 'none' : 'flex';
      popOut.style.display = playingHere || pipOpen ? 'none' : '';
    };

    // ---- player wiring ----------------------------------------------------

    const mirror = (tick: PlayerTick) => {
      if (!video || owns() || tick.instanceId === INSTANCE || tick.lesson !== lesson) return;
      if (!video.paused) video.pause();
      if (pinned) {
        if (video.currentTime !== 0) video.currentTime = 0;
        render();
        return;
      }
      if (Math.abs(video.currentTime - tick.currentTime) > DRIFT) {
        video.currentTime = tick.currentTime;
      }
      render();
    };

    const syncPip = () => {
      pipOpen = !!document.pictureInPictureElement;
      render();
    };

    // Their markup can't be unwrapped, but it can be collapsed: hide every
    // sibling on the path from the video to the body and the frame renders as
    // just the picture, with no player chrome to design around.
    const stripChrome = () => {
      if (!video) return;
      for (let node: HTMLElement = video; node.parentElement; node = node.parentElement) {
        for (const sibling of Array.from(node.parentElement.children)) {
          if (sibling !== node && sibling !== overlay) {
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
      if (CARD) document.documentElement.append(overlay);
    };

    // The player twitches for a moment after load — seeking, buffering, first
    // decode. The card holds its still over the top until a frame is actually
    // on screen. Event-driven checking is not enough: pinned and paused, the
    // video stops emitting anything, so a missed check would wait forever.
    let settled = false;
    // The first painted frame is not the last twitch — the player still seeks
    // and re-decodes after it. Holding past that is cheaper than trying to
    // detect the end of it.
    const HOLD = 800;
    const settle = () => {
      if (!CARD || settled) return;
      settled = true;
      setTimeout(() => browser.storage.local.set({ [`ready_${CARD_ID}`]: Date.now() }), HOLD);
    };

    const watchForFirstFrame = () => {
      if (!CARD || !video) return;
      type WithFrameCallback = HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => void;
      };
      const withCallback = video as WithFrameCallback;
      withCallback.requestVideoFrameCallback?.(settle);

      const poll = setInterval(() => {
        if (settled) return clearInterval(poll);
        if (video && video.readyState >= 2) {
          clearInterval(poll);
          settle();
        }
      }, 200);
      // A player that never reports a frame shouldn't leave the card spinning.
      setTimeout(() => {
        clearInterval(poll);
        settle();
      }, 4000);
    };

    const attach = () => {
      const found = document.querySelector('video');
      if (!found || found === video) return;
      video = found;
      video.playbackRate = RATE;
      video.controls = IN_PAGE;
      video.addEventListener('ratechange', () => {
        if (video && video.playbackRate !== RATE) video.playbackRate = RATE;
      });
      if (pinned) video.currentTime = 0;

      // The embed asks for autoplay and calls play() well after load, so a
      // single pause() here loses the race. Every play is refused until
      // something actually asks for one.
      video.addEventListener('play', () => {
        if (pinned || !wanted) {
          video?.pause();
          return;
        }
        claim();
        render();
      });
      video.addEventListener('pause', render);
      watchForFirstFrame();
      if (IN_PAGE) pageStarting = 0;
      video.addEventListener('timeupdate', () => {
        if (pinned && video) {
          if (!video.paused) video.pause();
          if (video.currentTime !== 0) video.currentTime = 0;
          return;
        }
        report();
      });
      video.addEventListener('ended', () => {
        browser.storage.local.set({ lessonEnded: { lesson, at: Date.now() } });
      });
      video.addEventListener('enterpictureinpicture', syncPip);
      video.addEventListener('leavepictureinpicture', syncPip);
      if (pinned) video.pause();
      stripChrome();
      syncPip();
      render();
      if (IN_PAGE) play();
    };

    browser.storage.local.set({
      frameAlive: `${CARD ? 'card' : IN_PAGE ? 'in-page' : 'bare'} frame running at ${new Date().toLocaleTimeString()}`,
    });

    // Only the main world can reach the player, so it confirms the swap.
    addEventListener('message', (event: MessageEvent) => {
      const swapped = (event.data as { ztmSwapped?: Omit<SwapResult, 'at'> })?.ztmSwapped;
      if (!swapped) return;
      if (!swapped.error) lesson = swapped.lesson;
      browser.storage.local.set({ swapResult: { ...swapped, at: Date.now() } });
    });

    attach();
    new MutationObserver(attach).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    setInterval(report, 1000);

    browser.storage.local.get(['owner', 'pageBeat']).then((stored) => {
      owner = (stored.owner as string) ?? null;
      pageBeat = (stored.pageBeat as number) ?? 0;
      render();
    });

    if (IN_PAGE) {
      const beat = () => browser.storage.local.set({ pageBeat: Date.now() });
      beat();
      setInterval(beat, 500);
      // Waiting for the heartbeat to lapse is a second the card doesn't need to
      // look wrong for, so say so on the way out.
      addEventListener('pagehide', () => browser.storage.local.set({ pageBeat: 0 }));
    }
    // The heartbeat has to be able to expire on its own, not only when it changes.
    if (CARD) setInterval(render, 1000);

    // The panel can't message this frame — it isn't in a tab, so tabs.sendMessage
    // has nothing to address. Storage is the only channel both ends share.
    browser.storage.onChanged.addListener((changes) => {
      if (changes.owner) owner = changes.owner.newValue as string;
      if (changes.pageBeat) {
        pageBeat = (changes.pageBeat.newValue as number) ?? 0;
        if (pageBeat === 0) pageStarting = 0;
        render();
      }
      if (changes.playerTick) mirror(changes.playerTick.newValue as PlayerTick);

      // The playing copy holds the activation and the popout; others must not answer.
      const swap = changes.swapReq?.newValue as SwapRequest | undefined;
      if (swap && owns()) {
        // The play handler pauses anything unasked for, so consent lands first.
        wanted = true;
        pinned = false;
        embedUrl = swap.embed;
        window.postMessage({ ztmSwap: { src: swap.src, lesson: swap.lesson } }, '*');
      }

      const seek = changes.seekReq?.newValue as SeekRequest | undefined;
      if (seek && video) {
        claim();
        // A pinned card resets itself to 0 on every tick, which would undo this.
        pinned = false;
        video.currentTime = seek.t;
      }
    });
  },
});
