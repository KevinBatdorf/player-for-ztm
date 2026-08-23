import { AnimatePresence, motion } from 'motion/react';
import { useReducer, useState, type Dispatch } from 'react';
import { Backdrop } from './Backdrop';
import { DevPanel } from './DevPanel';
import { Stage } from './Stage';
import { Player } from './Player';
import { Boot } from './views/Boot';
import { Course } from './views/Course';
import { CourseLoading } from './views/CourseLoading';
import { Home } from './views/Home';
import { IndexingCourses } from './views/IndexingCourses';
import { Search } from './views/Search';
import { SignedOut } from './views/SignedOut';
import { useFlair } from './settings';
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

export function App() {
  const [state, dispatch] = useReducer(reduce, initialState);
  // Boot holds its mark back until the field has drawn, so it needs to hear about it.
  const [fieldReady, setFieldReady] = useState(false);
  // The sheet's own position, not a step in the flow, so it stays out of the machine.
  const [raised, setRaised] = useState(false);
  const flair = useFlair();
  const stage = inside(state.view.name);
  // motion writes inline styles, which the `data-flair` blanket cannot reach.
  const seconds = flair === 'none' ? 0 : state.heading === 'none' ? 0.24 : 0.5;

  return (
    <div className="relative flex h-screen flex-col font-sans text-body text-ink">
      <Backdrop level={state.field} onReady={() => setFieldReady(true)} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {stage && <Stage />}

        {/* `auto` so collapsing the band never needs a measured height. */}
        {stage && (
          <motion.div
            className="relative shrink-0 overflow-hidden"
            animate={{ height: raised ? 0 : 'auto' }}
            transition={{ duration: seconds, ease: CURVE }}
          >
            <Player lesson={state.lesson} dispatch={dispatch} />
          </motion.div>
        )}

        {/* Fixed, the dev panel covered the bottom row of every screen even when collapsed. */}
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-hidden',
            // CSS rather than motion, so the `flair: none` blanket can zero it too.
            stage && 'rounded-t-sheet bg-sheet shadow-lift transition-[border-radius] duration-500 ease-panel',
            stage && raised && 'rounded-t-none',
          )}
        >
          {stage && (
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
                {renderView(state, dispatch, fieldReady)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <DevPanel state={state} dispatch={dispatch} />
    </div>
  );
}

/** Exhaustive by the compiler: a new union member breaks this switch. */
function renderView(state: AppState, dispatch: Dispatch<Action>, fieldReady: boolean) {
  const { view, awaitingLogin, lesson } = state;

  switch (view.name) {
    case 'boot':
      return <Boot dispatch={dispatch} fieldReady={fieldReady} />;
    case 'signedOut':
      return <SignedOut awaitingLogin={awaitingLogin} dispatch={dispatch} />;
    case 'indexingCourses':
      return <IndexingCourses dispatch={dispatch} />;
    case 'home':
      return <Home dispatch={dispatch} />;
    case 'search':
      return <Search view={view} lesson={lesson} dispatch={dispatch} />;
    case 'courseLoading':
      return <CourseLoading view={view} dispatch={dispatch} />;
    case 'course':
      return <Course view={view} lesson={lesson} dispatch={dispatch} />;
  }
}
