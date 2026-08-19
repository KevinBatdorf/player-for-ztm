import { browser } from '#imports';

const ORIGIN = 'https://academy.zerotomastery.io';

/** Needs a session, so Rails 302s it to the public catalogue without one. */
const GATE = `${ORIGIN}/courses/enrolled`;

/** Teachable's own path, which hands off to the SSO one-time-code form. */
const LOGIN_URL = `${ORIGIN}/sign_in`;

/** A black-holed request never rejects, and the splash would wait on it forever. */
const REACH_MS = 8_000;

export async function hasSession(): Promise<boolean> {
  try {
    // HEAD because the status line is the whole answer and the redirect target is 450KB.
    const res = await fetch(GATE, {
      method: 'HEAD',
      credentials: 'include',
      signal: AbortSignal.timeout(REACH_MS),
    });
    // Not content: the signed-out page carries a `.user-signout` selector inside a script.
    return res.ok && new URL(res.url).pathname.startsWith('/courses/enrolled');
  } catch {
    // Unreachable and timed out both read as signed out: that screen is the fix for either.
    return false;
  }
}

/** The code arrives by email, so there is no form to script. */
export const openLogin = () => browser.tabs.create({ url: LOGIN_URL, active: true });
