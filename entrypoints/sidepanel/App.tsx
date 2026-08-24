import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useReducer, useState, type Dispatch } from 'react';
import { Backdrop } from './Backdrop';
import { DotGrid } from './DotGrid';
import { Player } from './Player';
import { Boot } from './views/Boot';
import { Course } from './views/Course';
import { Home } from './views/Home';
import { IndexingCourses } from './views/IndexingCourses';
import { Search } from './views/Search';
import { SignedOut } from './views/SignedOut';
import {
  inside,
  initialState,
  reduce,
  type Action,
  type AppState,
  type Heading,
  type ViewName,
} from '@/lib/machine';
import { cn } from '@/lib/utils';

/** Without `custom`, the leaving screen animates on the heading it mounted with. */
const SLIDE = {
  enter: (heading: Heading) => ({
    x: heading === 'in' ? '100%' : heading === 'out' ? '-100%' : 0,
    opacity: heading === 'none' ? 0 : 1,
  }),
  here: { x: 0, opacity: 1 },
  leave: (heading: Heading) => ({
    x: heading === 'in' ? '-100%' : heading === 'out' ? '100%' : 0,
    opacity: heading === 'none' ? 0 : 1,
  }),
};

/** Front-loaded on purpose; a symmetric ease reads as sluggish over a full panel width. */
const CURVE = [0.32, 0.72, 0, 1] as const;

/** Keyed apart, a cached curriculum resolves them a frame apart and cuts the first slide short. */
const screenKey = (name: ViewName) => (name === 'courseLoading' ? 'course' : name);

/** Fixed, or the canvas's collapse changes speed depending on how you last navigated. */
const RAISE = 0.42;

export function App() {
  const [state, dispatch] = useReducer(reduce, initialState);
  // Boot holds its mark back until the backdrop has drawn, so it needs to hear about it.
  const [backdropReady, setFieldReady] = useState(false);
  // The sheet's own position, not a step in the flow, so it stays out of the machine.
  const [raised, setRaised] = useState(false);
  const showsPlayer = inside(state.view.name);
  // A fresh object each render restarts the height animation on every unrelated re-render.
  const canvasHeight = useMemo(() => ({ height: raised ? 0 : 'auto' }) as const, [raised]);
  const seconds = state.heading === 'none' ? 0.24 : 0.5;

  return (
    <div className="relative flex h-screen flex-col font-sans text-body text-ink">
      <Backdrop level={state.backdrop} onReady={() => setFieldReady(true)} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {showsPlayer && <DotGrid />}

        {/* `auto` so collapsing the canvas never needs a measured height. */}
        {showsPlayer && (
          <motion.div
            className="relative shrink-0 overflow-hidden"
            animate={canvasHeight}
            transition={{ duration: RAISE, ease: CURVE }}
          >
            <Player lesson={state.lesson} collapsed={raised} dispatch={dispatch} />
          </motion.div>
        )}

        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-hidden',
            showsPlayer && 'rounded-t-sheet bg-sheet shadow-lift transition-[border-radius] duration-500 ease-panel',
            showsPlayer && raised && 'rounded-t-none',
          )}
        >
          {showsPlayer && (
            <button
              type="button"
              onClick={() => setRaised((up) => !up)}
              aria-expanded={raised}
              aria-label={raised ? 'Lower the list' : 'Raise the list over the player'}
              className="group flex w-full shrink-0 items-center justify-center py-2.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <span className="h-1 w-9 rounded-full bg-line-strong transition-colors duration-150 ease-panel group-hover:bg-ink-faint" />
            </button>
          )}

          <div className="relative min-h-0 flex-1">
            {/* No `mode`: `wait` runs exit to completion, so the two could never overlap. */}
            <AnimatePresence initial={false} custom={state.heading}>
              <motion.div
                key={screenKey(state.view.name)}
                custom={state.heading}
                variants={SLIDE}
                initial="enter"
                animate="here"
                exit="leave"
                className="absolute inset-0"
                transition={{ duration: seconds, ease: CURVE }}
              >
                {renderView(state, dispatch, backdropReady)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Exhaustive by the compiler: a new union member breaks this switch. */
function renderView(state: AppState, dispatch: Dispatch<Action>, backdropReady: boolean) {
  const { view, awaitingLogin, lesson } = state;

  switch (view.name) {
    case 'boot':
      return <Boot dispatch={dispatch} backdropReady={backdropReady} />;
    case 'signedOut':
      return <SignedOut awaitingLogin={awaitingLogin} dispatch={dispatch} />;
    case 'indexingCourses':
      return <IndexingCourses dispatch={dispatch} />;
    case 'home':
      return <Home dispatch={dispatch} />;
    case 'search':
      return <Search view={view} lesson={lesson} dispatch={dispatch} />;
    // One component for both: the loading line flashed for a frame on a warm cache.
    case 'courseLoading':
    case 'course':
      return <Course view={view} lesson={lesson} dispatch={dispatch} />;
  }
}
