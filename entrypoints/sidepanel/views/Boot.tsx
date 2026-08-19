import { useEffect, type Dispatch } from 'react';
import { Reveal } from '../Screen';
import { useFlair, useHold, useVariant } from '../settings';
import type { Action } from '@/lib/machine';
import { hasSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const WORDMARK = 'Player for ZTM';

const TITLE = 'text-display leading-tight font-medium tracking-tight text-ink';

/** Without a floor the check outruns the eye and the splash strobes. */
const FLOOR_MS = 620;

export function Boot({ dispatch }: { dispatch: Dispatch<Action> }) {
  const variant = useVariant('boot');
  const flair = useFlair();
  const held = useHold();

  // Remount is the trigger: signing in rewinds to `boot`, so the deps need no view key.
  useEffect(() => {
    if (held) return;
    let live = true;
    const floor = flair === 'none' ? 0 : FLOOR_MS;

    void Promise.all([hasSession(), new Promise((done) => setTimeout(done, floor))]).then(
      ([signedIn]) => {
        if (live) dispatch({ type: signedIn ? 'sessionFound' : 'sessionMissing' });
      },
    );

    return () => {
      live = false;
    };
  }, [dispatch, flair, held]);

  return variant === 'bars' ? <Bars /> : <Wordmark />;
}

function Wordmark() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-paper px-6">
      <Reveal text={WORDMARK} align="center" className={cn(TITLE, 'text-center')} />

      <div className="h-[max(2px,var(--t-line-w))] w-28 overflow-hidden bg-line">
        <span className="block h-full w-1/4 animate-[panel-sweep_1.6s_var(--t-ease)_infinite] bg-accent" />
      </div>

      <p className="text-caption text-ink-faint">Checking your ZTM session…</p>
    </div>
  );
}

function Bars() {
  return (
    <div className="flex h-full flex-col justify-between bg-paper p-4">
      <p className="font-mono text-caption tracking-[0.18em] text-ink-faint uppercase">
        Zero To Mastery
      </p>

      <div>
        <Reveal text={WORDMARK} className={TITLE} />
        {/* opacity-20 is what shows at `flair: none`, where no keyframe applies. */}
        <div className="mt-3 flex gap-1" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="h-4 flex-1 animate-[panel-tick_1.4s_var(--t-ease)_infinite] bg-accent opacity-20"
              style={{ animationDelay: `${i * 85}ms` }}
            />
          ))}
        </div>
      </div>

      <p className="font-mono text-caption text-ink-faint">checking session…</p>
    </div>
  );
}
