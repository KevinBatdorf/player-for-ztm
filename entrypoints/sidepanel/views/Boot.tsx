import { motion } from 'motion/react';
import { useEffect, type Dispatch } from 'react';
import { useFlair, useHold } from '../settings';
import { ZTM_MARK, ZTM_MARK_FONT } from '@/lib/brand';
import type { Action } from '@/lib/machine';
import { hasSession } from '@/lib/session';

/** Without a floor the check outruns the eye and the splash is gone before it reads. */
const FLOOR_MS = 3000;

const SCRIM = { textShadow: '0 1px 10px rgba(var(--t-scrim), 0.95)' };

/** Shorter than this and an 86px letter reads as a pop rather than a wipe. */
const WIPE = 0.95;

/** Everything has to land inside FLOOR_MS or the splash leaves mid-sequence. */
const STEP = 0.14;

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
        transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.1 }}
      >
        Player for
      </motion.p>

      {/* The clip is the wipe; without it the letters only translate. */}
      <div className="flex items-baseline" style={{ fontFamily: ZTM_MARK_FONT }}>
        {ZTM_MARK.map(({ char, color }, i) => (
          <span key={char} className="block overflow-hidden">
            <motion.span
              className="block text-[86px] leading-none font-black tracking-[-0.02em]"
              style={{ color }}
              initial={quiet ? false : { y: '108%' }}
              animate={{ y: '0%' }}
              transition={{ duration: WIPE, ease: EASE_OUT, delay: 0.28 + i * STEP }}
            >
              {char}
            </motion.span>
          </span>
        ))}
      </div>

      {/* Its delay has to clear the last letter, or it lands mid-wipe. */}
      <motion.div
        className="mt-5 h-px w-20 origin-center bg-accent/50"
        initial={quiet ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 1.55 }}
      />

      <motion.p
        className="mt-4 text-caption text-ink opacity-80"
        style={SCRIM}
        initial={quiet ? false : { opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: 2.1 }}
      >
        Checking your session…
      </motion.p>
    </div>
  );
}
