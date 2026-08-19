import { useReducer, useState, type Dispatch } from 'react';
import { Backdrop } from './Backdrop';
import { DevPanel } from './DevPanel';
import { Boot } from './views/Boot';
import { Course } from './views/Course';
import { CourseLoading } from './views/CourseLoading';
import { Home } from './views/Home';
import { IndexingCourses } from './views/IndexingCourses';
import { Playing } from './views/Playing';
import { Search } from './views/Search';
import { SignedOut } from './views/SignedOut';
import { initialState, reduce, type Action, type AppState } from '@/lib/machine';

export function App() {
  const [state, dispatch] = useReducer(reduce, initialState);
  // Boot holds its mark back until the field has drawn, so it needs to hear about it.
  const [fieldReady, setFieldReady] = useState(false);

  return (
    <div className="relative h-screen font-sans text-body text-ink">
      <Backdrop view={state.view.name} onReady={() => setFieldReady(true)} />
      <div className="relative h-full">{renderView(state, dispatch, fieldReady)}</div>
      {/* A literal false in a build, so DevPanel is tree-shaken out. */}
      {import.meta.env.DEV && <DevPanel state={state} dispatch={dispatch} />}
    </div>
  );
}

/** Exhaustive by the compiler: a new union member breaks this switch. */
function renderView(state: AppState, dispatch: Dispatch<Action>, fieldReady: boolean) {
  const { view, indexer, awaitingLogin } = state;

  switch (view.name) {
    case 'boot':
      return <Boot dispatch={dispatch} fieldReady={fieldReady} />;
    case 'signedOut':
      return <SignedOut awaitingLogin={awaitingLogin} dispatch={dispatch} />;
    case 'indexingCourses':
      return <IndexingCourses dispatch={dispatch} />;
    case 'home':
      return <Home indexer={indexer} dispatch={dispatch} />;
    case 'search':
      return <Search view={view} indexer={indexer} dispatch={dispatch} />;
    case 'courseLoading':
      return <CourseLoading view={view} dispatch={dispatch} />;
    case 'course':
      return <Course view={view} indexer={indexer} dispatch={dispatch} />;
    case 'playing':
      return <Playing view={view} dispatch={dispatch} />;
  }
}
