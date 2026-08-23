import { motion } from 'motion/react';
import { useEffect, type Dispatch } from 'react';
import { useFlair, useHold } from '../settings';
import { ZTM_MARK, ZTM_MARK_FONT } from '@/lib/brand';
import type { Action } from '@/lib/machine';
import { hasSession } from '@/lib/session';

/** Without a floor the check outruns the eye and the splash is gone before it reads. */
const FLOOR_MS = 3000;

const SCRIM = { textShadow: '0 1px 10px rgba(var(--t-scrim), 0.95)' };

const ARRIVALS = [
  { x: -64, y: -34, rotate: -12 },
  { x: 0, y: 54, rotate: 0 },
  { x: 64, y: -34, rotate: 12 },
] as const;

const SETTLE = { type: 'spring', stiffness: 190, damping: 16, mass: 0.9 } as const;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

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
    <div className="relative flex h-full flex-col items-center justify-start pt-[15vh]">
      <motion.p
        className="mb-1 text-caption text-ink uppercase"
        style={SCRIM}
        initial={quiet ? false : { opacity: 0, letterSpacing: '0.9em' }}
        animate={{ opacity: 0.8, letterSpacing: '0.28em' }}
        transition={{ duration: 1, ease: EASE_OUT, delay: 0.1 }}
      >
        Player for
      </motion.p>

      <div className="flex items-baseline" style={{ fontFamily: ZTM_MARK_FONT }}>
        {ZTM_MARK.map(({ char, color }, i) => (
          <motion.span
            key={char}
            className="text-[86px] leading-none font-black tracking-[-0.02em]"
            style={{ color }}
            initial={quiet ? false : { opacity: 0, filter: 'blur(10px)', ...ARRIVALS[i] }}
            animate={{ opacity: 1, filter: 'blur(0px)', x: 0, y: 0, rotate: 0 }}
            transition={{ ...SETTLE, delay: 0.24 + i * 0.08 }}
          >
            {char}
          </motion.span>
        ))}
      </div>

      {/* Its delay has to clear the letters' spring, or it lands mid-movement. */}
      <motion.div
        className="mt-5 h-px w-20 origin-center bg-accent/50"
        initial={quiet ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.7 }}
      />

      <motion.p
        className="mt-4 text-caption text-ink opacity-80"
        style={SCRIM}
        initial={quiet ? false : { opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.95 }}
      >
        Checking your session…
      </motion.p>
    </div>
  );
}
