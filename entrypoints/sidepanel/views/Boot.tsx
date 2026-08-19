import { lazy, Suspense, useEffect, useState, type Dispatch } from 'react';
import { Reveal } from '../Screen';
import { useFlair, useHold, useVariant } from '../settings';
import LetterGlitch from '@/components/react-bits/letter-glitch';
import { ZTM_GREEN, ZTM_GROUND, ZTM_MARK, ZTM_MARK_FONT, ZTM_PINK, ZTM_PURPLE } from '@/lib/brand';
import type { Action } from '@/lib/machine';
import { hasSession } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Split because it drags in three; only this variant pays, and only past `none`. */
const Watercolor = lazy(() => import('@/components/react-bits/watercolor'));

const WORDMARK = 'Player for ZTM';

const TITLE = 'text-display leading-tight font-medium tracking-tight text-ink';

/** Without a floor the check outruns the eye and the splash is gone before it reads. */
const FLOOR_MS = 3000;

/** WebGL can be blocked or the chunk can fail; the mark appears regardless. */
const WASH_GRACE_MS = 1200;

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

  const quiet = flair === 'none';
  if (variant === 'glitch') return <Glitch quiet={quiet} />;
  if (variant === 'brand') return <Brand quiet={quiet} />;
  return variant === 'bars' ? <Bars /> : <Wordmark />;
}

function Glitch({ quiet }: { quiet: boolean }) {
  return (
    <div className="relative h-full overflow-hidden" style={{ backgroundColor: ZTM_GROUND }}>
      {/* Its own rAF loop, which the `flair: none` blanket cannot stop. */}
      {!quiet && (
        <div className="absolute inset-0">
          <LetterGlitch
            glitchColors={[ZTM_GREEN, ZTM_PINK, ZTM_PURPLE]}
            glitchSpeed={45}
            centerVignette
            outerVignette={false}
          />
          <Vignette alpha="ee" />
        </div>
      )}
      <Mark />
    </div>
  );
}

function Brand({ quiet }: { quiet: boolean }) {
  // Showing the mark before the shader's first frame shows it against bare black.
  const [lit, setLit] = useState(quiet);

  useEffect(() => {
    if (lit) return;
    const grace = setTimeout(() => setLit(true), WASH_GRACE_MS);
    return () => clearTimeout(grace);
  }, [lit]);

  return (
    <div className="relative h-full overflow-hidden" style={{ backgroundColor: ZTM_GROUND }}>
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-700 ease-panel',
          lit ? 'opacity-100' : 'opacity-0',
        )}
      >
        {!quiet && (
          <Suspense fallback={null}>
            {/* saturation defaults to 0, which collapses this shader to luminance. */}
            <Watercolor
              color1={ZTM_PURPLE}
              color2={ZTM_PINK}
              speed={0.25}
              scale={0.8}
              saturation={1.2}
              brightness={0}
              opacity={0.38}
              cursorInteraction={false}
              onReady={() => setLit(true)}
            />
          </Suspense>
        )}

        <Vignette alpha="c4" />
      </div>

      {/* opacity does not stop an IntersectionObserver: hidden, the letters reveal unseen. */}
      {lit && <Mark />}
    </div>
  );
}

/** Both fields move, so the mark's contrast cannot depend on what is under it. */
function Vignette({ alpha }: { alpha: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(64% 42% at 50% 47%, ${ZTM_GROUND}${alpha}, transparent 74%)`,
      }}
    />
  );
}

function Mark() {
  return (
    <div className="animate-in fade-in relative flex h-full flex-col items-center justify-center text-white duration-700">
      {/* White rather than `--t-ink`, because these grounds do not follow the theme. */}
      <p className="mb-1 text-caption tracking-[0.28em] uppercase opacity-70">Player for</p>

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

      <p className="mt-7 text-caption opacity-70">Checking your session…</p>
    </div>
  );
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
