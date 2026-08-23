import { useEffect, type Dispatch } from 'react';
import { Reveal } from '../Screen';
import { useFlair, useHold } from '../settings';
import { ZTM_MARK, ZTM_MARK_FONT } from '@/lib/brand';
import type { Action } from '@/lib/machine';
import { hasSession } from '@/lib/session';

/** Without a floor the check outruns the eye and the splash is gone before it reads. */
const FLOOR_MS = 3000;

export function Boot({
  dispatch,
  fieldReady,
}: {
  dispatch: Dispatch<Action>;
  fieldReady: boolean;
}) {
  const flair = useFlair();
  const held = useHold();
  const quiet = flair === 'none';

  // Remount is the trigger: signing in rewinds to `boot`, so the deps need no view key.
  useEffect(() => {
    if (held) return;
    let live = true;
    const floor = quiet ? 0 : FLOOR_MS;

    void Promise.all([hasSession(), new Promise((done) => setTimeout(done, floor))]).then(
      ([signedIn]) => {
        if (live) dispatch({ type: signedIn ? 'sessionFound' : 'sessionMissing' });
      },
    );

    return () => {
      live = false;
    };
  }, [dispatch, quiet, held]);

  // Mounted on the field's first frame rather than faded from hidden: opacity does not
  // stop an IntersectionObserver, so the letters would reveal unseen.
  if (!quiet && !fieldReady) return null;

  return (
    <div className="animate-in fade-in relative flex h-full flex-col items-center justify-start pt-[15vh] duration-700">
      {/* Caption weight loses to the field; the mark's 86px bold does not. */}
      <p className="mb-1 text-caption tracking-[0.28em] text-ink uppercase opacity-80" style={SCRIM}>
        Player for
      </p>

      <div className="flex items-baseline" style={{ fontFamily: ZTM_MARK_FONT }}>
        {ZTM_MARK.map(({ char, color }, i) => (
          <span key={char} style={{ color }}>
            <Reveal
              as="span"
              text={char}
              blur={false}
              duration={0.4 + i * 0.14}
              className="text-[86px] leading-none font-black tracking-[-0.02em]"
            />
          </span>
        ))}
      </div>

      <p className="mt-7 text-caption text-ink opacity-80" style={SCRIM}>
        Checking your session…
      </p>
    </div>
  );
}

const SCRIM = { textShadow: '0 1px 10px rgba(var(--t-scrim), 0.95)' };
