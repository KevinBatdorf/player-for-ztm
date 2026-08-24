import { motion } from 'motion/react';
import { lazy, Suspense, useEffect, type CSSProperties, type Dispatch } from 'react';
import { ZTM_MARK, ZTM_MARK_FONT } from '@/lib/brand';
import type { Action } from '@/lib/machine';
import { hasSession } from '@/lib/session';

const StaggeredText = lazy(() => import('@/components/react-bits/staggered-text'));

/** Without a floor the check outruns the eye and the splash is gone before it reads. */
const FLOOR_MS = 3000;

const SCRIM = { textShadow: '0 1px 10px rgba(var(--t-scrim), 0.95)' };

/** Everything has to land inside FLOOR_MS or the splash leaves mid-sequence. */
const STEP_MS = 220;

const GATHER = 1.35;

/** Deliberately no travel: a letter resolves in place. */
const DUST = { opacity: 0, filter: 'blur(18px)', scale: 1.5, y: 8 };

const SOLID = { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 };

const MARK = ZTM_MARK.map(({ char }) => char).join('');

/** Depends on it rendering one span per char as a direct child. */
const PER_LETTER = [
  '[&>span:nth-child(1)]:text-[var(--mark-1)]',
  '[&>span:nth-child(2)]:text-[var(--mark-2)]',
  '[&>span:nth-child(3)]:text-[var(--mark-3)]',
].join(' ');

const MARK_COLORS = Object.fromEntries(
  ZTM_MARK.map(({ color }, i) => [`--mark-${i + 1}`, color]),
) as CSSProperties;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function Boot({
  dispatch,
  backdropReady,
}: {
  dispatch: Dispatch<Action>;
  backdropReady: boolean;
}) {
  // Remount is the trigger: signing in rewinds to `boot`, so the deps need no view key.
  useEffect(() => {
    let live = true;
    void Promise.all([hasSession(), new Promise((done) => setTimeout(done, FLOOR_MS))]).then(
      ([signedIn]) => {
        if (live) dispatch({ type: signedIn ? 'sessionFound' : 'sessionMissing' });
      },
    );

    return () => {
      live = false;
    };
  }, [dispatch]);

  // Mounted on the field's first frame rather than faded from hidden: opacity does not
  // stop an IntersectionObserver, so the letters would reveal unseen.
  if (!backdropReady) return null;

  return (
    <div className="relative flex h-full flex-col items-center justify-start pt-[15vh]">
      <motion.p
        className="mb-1 text-caption text-ink uppercase"
        style={SCRIM}
        initial={{ opacity: 0, letterSpacing: '0.9em' }}
        animate={{ opacity: 0.8, letterSpacing: '0.28em' }}
        transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.1 }}
      >
        Player for
      </motion.p>

      <div
        className="text-[86px] leading-none font-black tracking-[-0.02em]"
        style={{ fontFamily: ZTM_MARK_FONT, ...MARK_COLORS }}
      >
        <Suspense fallback={<span className="invisible">{MARK}</span>}>
          <StaggeredText
            as="span"
            text={MARK}
            segmentBy="chars"
            delay={STEP_MS}
            duration={GATHER}
            easing={[0.16, 1, 0.3, 1]}
            from={DUST}
            to={SOLID}
            className={PER_LETTER}
          />
        </Suspense>
      </div>

      {/* Its delay has to clear the last letter, or it lands mid-gather. */}
      <motion.div
        className="mt-5 h-px w-20 origin-center bg-accent/50"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 1.9 }}
      />

      <motion.p
        className="mt-4 text-caption text-ink opacity-80"
        style={SCRIM}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 2.2 }}
      >
        Checking your session…
      </motion.p>
    </div>
  );
}
