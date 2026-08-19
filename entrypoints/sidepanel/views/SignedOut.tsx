import { useCallback, useEffect, type Dispatch } from 'react';
import { Cta, Reveal } from '../Screen';
import { useVariant } from '../settings';
import type { Action } from '@/lib/machine';
import { openLogin } from '@/lib/session';
import { cn } from '@/lib/utils';

const HEADING = 'Sign in to ZTM';

const HEADING_TYPE = 'text-display leading-tight font-medium tracking-tight text-ink';

export function SignedOut({
  awaitingLogin,
  dispatch,
}: {
  awaitingLogin: boolean;
  dispatch: Dispatch<Action>;
}) {
  const variant = useVariant('signedOut');

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

  const props = { awaiting: awaitingLogin, send, recheck };
  return variant === 'steps' ? <Steps {...props} /> : <Card {...props} />;
}

type Props = { awaiting: boolean; send: () => void; recheck: () => void };

const label = (awaiting: boolean) => (awaiting ? 'Reopen the ZTM tab' : 'Open ZTM to sign in');

function Card({ awaiting, send, recheck }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-paper px-4">
      <div className="rule flex w-full flex-col gap-3 rounded-panel bg-raised p-4 shadow-panel">
        <Reveal text={HEADING} className={HEADING_TYPE} />
        <p className="text-body leading-relaxed text-ink-soft">
          Zero To Mastery emails a one-time code, so signing in happens on their site rather
          than here. This panel picks the session up when you come back.
        </p>
        <Cta onClick={send}>{label(awaiting)}</Cta>
        {awaiting && <Waiting onClick={recheck} />}
      </div>
    </div>
  );
}

const STEPS = ['Open ZTM in a new tab', 'Enter the code they email you', 'Come back to this panel'];

function Steps({ awaiting, send, recheck }: Props) {
  const at = awaiting ? 1 : 0;

  return (
    <div className="flex h-full flex-col bg-paper">
      <header className="rule-b flex flex-col gap-1 px-4 py-3">
        <p className="font-mono text-caption tracking-[0.18em] text-ink-faint uppercase">
          Signed out
        </p>
        <Reveal text={HEADING} className={HEADING_TYPE} />
      </header>

      <ol className="flex flex-col">
        {STEPS.map((step, i) => (
          <li key={step} className="rule-b flex items-baseline gap-3 px-4 py-3">
            <span
              className={cn(
                'font-mono text-caption',
                i === at ? 'text-accent-text' : 'text-ink-faint',
              )}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={cn('text-body', i === at ? 'text-ink' : 'text-ink-soft')}>{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-col gap-3 p-4">
        <Cta onClick={send}>{label(awaiting)}</Cta>
        {awaiting && <Waiting onClick={recheck} />}
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
