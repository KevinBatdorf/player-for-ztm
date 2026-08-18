// Runs in the page's own JS context: the player is a page object an isolated
// script cannot see. No extension APIs here, so results cross by postMessage.
export default defineContentScript({
  matches: ['https://player.hotmart.com/*'],
  allFrames: true,
  world: 'MAIN',
  main() {
    type Player = { src: (source: { src: string; type: string }) => void };
    type PlayerElement = HTMLElement & { player?: Player };

    const HLS = 'application/x-mpegURL';

    // video.js parks the instance on the element it wraps; there is no global.
    const find = () =>
      (document.querySelector('.video-js') as PlayerElement | null)?.player ?? null;

    const swap = ({ src, lesson }: { src: string; lesson: string }) => {
      const player = find();
      const video = document.querySelector('video');
      if (!player || !video) {
        window.postMessage({ ztmSwapped: { lesson, error: 'no player in this frame' } }, '*');
        return;
      }
      const settle = (playing: boolean) =>
        window.postMessage({ ztmSwapped: { lesson, playing } }, '*');

      // A source that never loads would leave the panel saying it is still swapping.
      const giveUp = setTimeout(() => settle(false), 10_000);

      // Unmuted play rides the activation the user already spent; a frame nobody
      // has played holds on the first frame instead.
      const start = () => {
        clearTimeout(giveUp);
        video.play().then(
          () => settle(true),
          () => settle(false),
        );
      };

      // src() reloads asynchronously: playing before this fires resolves against
      // the outgoing video and leaves the swap paused at zero.
      video.addEventListener('loadedmetadata', start, { once: true });
      // Activation and any open Picture-in-Picture die with this document.
      player.src({ src, type: HLS });
    };

    addEventListener('message', (event: MessageEvent) => {
      const request = (event.data as { ztmSwap?: { src: string; lesson: string } })?.ztmSwap;
      if (request) swap(request);
    });
  },
});
