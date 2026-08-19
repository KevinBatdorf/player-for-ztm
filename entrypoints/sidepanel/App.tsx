import { useReducer, type Dispatch } from 'react';
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

  return (
    <div className="flex h-screen flex-col bg-paper font-sans text-body text-ink">
      <div className="min-h-0 flex-1">{renderView(state, dispatch)}</div>
      {/* A literal false in a build, so DevPanel is tree-shaken out. */}
      {import.meta.env.DEV && <DevPanel state={state} dispatch={dispatch} />}
    </div>
  );
}

/** Exhaustive by the compiler: a new union member breaks this switch. */
function renderView(state: AppState, dispatch: Dispatch<Action>) {
  const { view, indexer, awaitingLogin } = state;

  switch (view.name) {
    case 'boot':
      return <Boot dispatch={dispatch} />;
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
