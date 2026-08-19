import { lazy, Suspense, useEffect, useState, type Dispatch } from 'react';
import { Reveal } from '../Screen';
import { useFlair, useHold, useVariant } from '../settings';
import LetterGlitch from '@/components/react-bits/letter-glitch';
import {
  ZTM_GREEN,
  ZTM_GROUND,
  ZTM_GROUND_RGB,
  ZTM_MARK,
  ZTM_MARK_FONT,
  ZTM_PINK,
  ZTM_PURPLE,
} from '@/lib/brand';
import type { Action } from '@/lib/machine';
import { hasSession } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Split because it drags in three; only this variant pays, and only past `none`. */
const Watercolor = lazy(() => import('@/components/react-bits/watercolor'));

/** Also on three, so also split. */
const PixelSnow = lazy(() => import('@/components/react-bits/pixel-snow'));

const WORDMARK = 'Player for ZTM';

const TITLE = 'text-display leading-tight font-medium tracking-tight text-ink';

/** Without a floor the check outruns the eye and the splash is gone before it reads. */
const FLOOR_MS = 3000;

/** The glitch field at full strength competes with the mark instead of sitting behind it. */
const FIELD_OPACITY = 0.5;

/** WebGL can be blocked or the chunk can fail; the mark appears regardless. */
const WASH_GRACE_MS = 1200;

export function Boot({
  dispatch,
  fieldReady,
}: {
  dispatch: Dispatch<Action>;
  fieldReady: boolean;
}) {
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
  if (variant === 'snow') return <Snow quiet={quiet} fieldReady={fieldReady} />;
  if (variant === 'glitch') return <Glitch quiet={quiet} />;
  if (variant === 'brand') return <Brand quiet={quiet} />;
  return variant === 'bars' ? <Bars /> : <Wordmark />;
}

/** Holds the mark back until the field is up, so it never lands on bare ground. */
function useLit(quiet: boolean, ready?: boolean) {
  const [lit, setLit] = useState(quiet);

  useEffect(() => {
    if (lit) return;
    if (ready) return setLit(true);
    const grace = setTimeout(() => setLit(true), WASH_GRACE_MS);
    return () => clearTimeout(grace);
  }, [lit, ready]);

  return lit;
}

function Snow({ quiet, fieldReady }: { quiet: boolean; fieldReady: boolean }) {
  return (
    <div className="relative h-full overflow-hidden">
      <Vignette strength={0.26} />
      {(quiet || fieldReady) && <Mark />}
    </div>
  );
}

function Glitch({ quiet }: { quiet: boolean }) {
  return (
    <div className="relative h-full overflow-hidden" style={{ backgroundColor: ZTM_GROUND }}>
      {/* Its own rAF loop, which the `flair: none` blanket cannot stop. */}
      {!quiet && (
        <div className="absolute inset-0" style={{ opacity: FIELD_OPACITY }}>
          <LetterGlitch
            glitchColors={[ZTM_GREEN, ZTM_PINK, ZTM_PURPLE]}
            glitchSpeed={45}
            centerVignette
            outerVignette={false}
          />
          <Vignette strength={0.32} />
        </div>
      )}
      <Mark />
    </div>
  );
}

function Brand({ quiet }: { quiet: boolean }) {
  const [drawn, setDrawn] = useState(false);
  const lit = useLit(quiet, drawn);

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
              onReady={() => setDrawn(true)}
            />
          </Suspense>
        )}

        <Vignette strength={0.78} />
      </div>

      {/* opacity does not stop an IntersectionObserver: hidden, the letters reveal unseen. */}
      {lit && <Mark />}
    </div>
  );
}

/** Both fields move, so the mark's contrast cannot depend on what is under it. */
function Vignette({ strength }: { strength: number }) {
  const ground = (alpha: number) => `rgba(${ZTM_GROUND_RGB}, ${alpha})`;

  // Three stops rather than two: a single ramp reaches transparent while still
  // over the mark, which puts a visible ring around it.
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: [
          'radial-gradient(104% 68% at 50% 47%,',
          `${ground(strength)} 0%,`,
          `${ground(strength * 0.7)} 34%,`,
          `${ground(strength * 0.28)} 62%,`,
          `${ground(0)} 88%)`,
        ].join(' '),
      }}
    />
  );
}

const LEGIBLE = { textShadow: `0 1px 10px rgba(${ZTM_GROUND_RGB}, 0.95)` };

function Mark() {
  return (
    <div className="animate-in fade-in relative flex h-full flex-col items-center justify-center text-white duration-700">
      {/* White rather than `--t-ink`, because these grounds do not follow the theme. */}
      {/* Caption weight loses to the glitch field; the mark's 86px bold does not. */}
      <p className="mb-1 text-caption tracking-[0.28em] uppercase opacity-80" style={LEGIBLE}>
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

      <p className="mt-7 text-caption opacity-80" style={LEGIBLE}>
        Checking your session…
      </p>
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
