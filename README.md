# Player for ZTM

Chrome side-panel extension for Zero To Mastery courses. Built with [WXT](https://wxt.dev).

The point of the architecture: the side panel hosts the video player itself, pops
it into Picture-in-Picture, and the user browses anywhere else while it plays.
ZTM never has to be open in a tab. See [PIP-FINDINGS.md](PIP-FINDINGS.md) for the
browser tests that shaped this.

## Load it

```bash
npm install && npm run build
```

Then in Chrome, open chrome://extensions → enable **Developer mode** → **Load
unpacked** → select `.output/chrome-mv3`.

Click the toolbar icon to open the side panel. You must be signed in to
`academy.zerotomastery.io` in that same Chrome profile.

For live reload during development, `npm run dev` launches its own Chrome with
the extension already loaded.

## What works so far

Paste a course URL (`/courses/enrolled/<id>`) and **Load** lists its lessons —
title, type and duration, scraped from the curriculum. Text lessons (`Subject`,
`Code`) are dimmed and unclickable; they have no video to sign. Clicking a video
lesson signs a player and renders it as a card: our own still with a spinner,
with the player behind it.

Three buttons sit on the video — **Play here**, **Play in browser**, **Pop out**.
Playing in the browser injects the player as a modal into whatever page you're
on; popping out puts it in Picture-in-Picture. The card blacks out and says where
the video went, and goes back to a still when you close it.

The buttons are inside the player frame rather than in the panel because PiP
needs a user gesture in the frame that owns the video. That constraint shapes the
whole UI — see [PIP-FINDINGS.md](PIP-FINDINGS.md).

**Mark watched on ZTM** writes progress back to Teachable — two POSTs, one for
the video and one for the lecture tick. Verified against the real site. Nothing
fires it automatically; it is a button on purpose.

A lecture URL also works in the box, but skips the listing, so **Next lesson**
and auto-advance have nothing to walk.

Clicking a second lesson does not rebuild the card — it swaps the source inside
the frame already there, which is what keeps a popped-out video alive across a
lesson change.

## Two pieces that look incidental and are not

- **`PLAYER_ALLOW` in `entrypoints/sidepanel/App.tsx`** — Teachable serves the
  player iframe with `allow="autoplay; fullscreen"`. Picture-in-Picture defaults
  to an allowlist of `self`, so PiP is denied inside their frame. Hosting the
  embed ourselves with the feature enabled is the only reason PiP is reachable.
- **`public/rules.json`** — `player.hotmart.com` refuses to be framed by other
  origins. The declarativeNetRequest rule strips the framing headers so a
  `chrome-extension://` page can host the player.

## Changing lesson without losing the video

The frame is mounted once. Every lesson change after that — auto-advance on
`ended`, **Next lesson**, or clicking any lesson in the list — hands the running
player a new source instead of pointing the iframe somewhere else. The document
survives, and so do the two things attached to it: the Picture-in-Picture window
and the user activation that lets playback start unmuted.

Setting `iframe.src` would keep the same element but load a new document, which
is what used to make a popped-out lesson die on advance.

Three pieces make it work:

- The player is video.js, reached at `document.querySelector('.video-js').player`.
  There is no global — `window.videojs` is undefined in this build.
- `player.src()` reloads asynchronously. Playing before `loadedmetadata` resolves
  against the outgoing video and leaves the swap paused at zero.
- The next lesson's signed HLS manifest is read out of its embed document by
  `resolveManifest` in the background, so nothing has to be framed to get one.
  Akamai answers 403 unless the application key is appended as `app`.

Manifest tokens last about eight minutes, so one is fetched per swap rather than
held.

## Known broken

Nothing is known broken. Picture-in-Picture surviving a swap is confirmed against
the real player but **not yet confirmed through the panel** — see
[PIP-FINDINGS.md](PIP-FINDINGS.md).

## Not built yet

Search, the in-progress/latest split, deck grouping, and watched state in the
listing — the curriculum is fetched signed out, so it carries no progress.
Multiple courses at once: the box takes one course URL.
