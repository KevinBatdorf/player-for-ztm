import { useCallback, useEffect, type Dispatch } from 'react';
import { Cta, Reveal } from '../Screen';
import type { Action } from '@/lib/machine';
import { openLogin } from '@/lib/session';

const HEADING = 'Sign in to ZTM';

const HEADING_TYPE = 'text-display leading-tight font-medium tracking-tight text-ink';

export function SignedOut({
  awaitingLogin,
  dispatch,
}: {
  awaitingLogin: boolean;
  dispatch: Dispatch<Action>;
}) {
  const recheck = useCallback(() => dispatch({ type: 'signedIn' }), [dispatch]);

  // Not armed on mount: the panel takes focus on every click into it, flashing the splash.
  useEffect(() => {
    if (!awaitingLogin) return;
    // The panel stays visible while another tab is focused, so `visibilitychange` never fires.
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [awaitingLogin, recheck]);

  const send = () => {
    dispatch({ type: 'loginOpened' });
    void openLogin();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="rule flex w-full flex-col gap-3 rounded-panel bg-raised p-4 shadow-panel">
        <Reveal text={HEADING} className={HEADING_TYPE} />
        <p className="text-body leading-relaxed text-ink-soft">
          Zero To Mastery emails a one-time code, so signing in happens on their site rather
          than here. This panel picks the session up when you come back.
        </p>
        <Cta onClick={send}>{awaitingLogin ? 'Reopen the ZTM tab' : 'Open ZTM to sign in'}</Cta>
        {awaitingLogin && <Waiting onClick={recheck} />}
      </div>
    </div>
  );
}

const Waiting = ({ onClick }: { onClick: () => void }) => (
  <div className="flex items-baseline justify-between gap-2">
    <p className="text-caption text-ink-faint">Re-checks when you come back.</p>
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-caption text-ink-soft underline decoration-line underline-offset-2 transition-colors duration-150 ease-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      Check now
    </button>
  </div>
);
