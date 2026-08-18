export default defineContentScript({
  matches: ['https://academy.zerotomastery.io/*'],
  allFrames: true,
  main() {
    const enablePip = (frame: HTMLIFrameElement) => {
      if (frame.dataset.pipEnabled) return;
      const allow = frame.getAttribute('allow') ?? '';
      if (allow.includes('picture-in-picture')) return;
      frame.dataset.pipEnabled = '1';
      frame.setAttribute('allow', `${allow}; picture-in-picture`);
      // Permission policy is fixed at navigation, so the frame has to reload.
      frame.src = frame.src;
    };

    const scan = () => {
      for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe')) {
        if (!/player\.hotmart\.com/.test(frame.src)) continue;
        // Teachable mints this signed URL client-side, which is why it can't be
        // scraped from the HTML. Caching it here is what lets us embed the
        // player on its own instead of the whole lecture page.
        browser.storage.local.set({
          embedUrl: frame.src,
          embedFor: location.href,
          embedAt: Date.now(),
        });
        enablePip(frame);
      }
    };

    // Finding the request that mints the signed embed URL is what replaces the
    // whole-page harvest with a single background fetch.
    const reportRequests = () => {
      const candidates = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter((entry) => entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'fetch')
        .map((entry) => entry.name)
        .filter((name) => !/\.(js|css|png|jpe?g|svg|woff2?|gif)(\?|$)/i.test(name));
      browser.storage.local.set({ apiCalls: [...new Set(candidates)].slice(0, 30) });
    };
    setTimeout(reportRequests, 4000);


    scan();
    new MutationObserver(scan).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  },
});
