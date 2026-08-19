/** ZTM's own ids, as they appear in course and lesson URLs. */
export type CourseId = string;
export type LessonId = string;

export type View =
  | { name: 'boot' }
  | { name: 'signedOut' }
  | { name: 'indexingCourses' }
  | { name: 'home' }
  | { name: 'search'; query: string }
  | { name: 'courseLoading'; courseId: CourseId }
  | { name: 'course'; courseId: CourseId }
  | { name: 'playing'; courseId: CourseId; lessonId: LessonId };

export type ViewName = View['name'];

export type IndexerProgress = { done: number; total: number };

export type AppState = {
  view: View;
  // Outside the union on purpose: three screens read it and it survives every transition.
  indexer: IndexerProgress;
};

export type Action =
  | { type: 'sessionMissing' }
  | { type: 'sessionFound' }
  | { type: 'signedIn' }
  | { type: 'courseListReady' }
  | { type: 'searchOpened' }
  | { type: 'searchChanged'; query: string }
  | { type: 'searchClosed' }
  | { type: 'coursePicked'; courseId: CourseId }
  | { type: 'courseReady'; courseId: CourseId }
  | { type: 'lessonPicked'; courseId: CourseId; lessonId: LessonId }
  | { type: 'lessonEnded'; nextLessonId: LessonId | null }
  | { type: 'playerClosed' }
  | { type: 'wentHome' }
  | { type: 'indexerProgressed'; done: number; total: number }
  | { type: 'jumped'; view: View };

export const initialState: AppState = {
  view: { name: 'boot' },
  indexer: { done: 0, total: 0 },
};

const go = (state: AppState, view: View): AppState => ({ ...state, view });

const from = (view: View, ...names: ViewName[]) => names.includes(view.name);

// Late replies from abandoned fetches are normal, so a stray action drops silently.
export function reduce(state: AppState, action: Action): AppState {
  const { view } = state;

  switch (action.type) {
    case 'sessionMissing':
      return view.name === 'boot' ? go(state, { name: 'signedOut' }) : state;

    case 'sessionFound':
      return view.name === 'boot' ? go(state, { name: 'indexingCourses' }) : state;

    // Checking is boot's job, so signing in rewinds there instead of skipping ahead.
    case 'signedIn':
      return view.name === 'signedOut' ? go(state, { name: 'boot' }) : state;

    case 'courseListReady':
      return view.name === 'indexingCourses' ? go(state, { name: 'home' }) : state;

    case 'searchOpened':
      return view.name === 'home' ? go(state, { name: 'search', query: '' }) : state;

    case 'searchChanged':
      return view.name === 'search' ? go(state, { name: 'search', query: action.query }) : state;

    case 'searchClosed':
      return view.name === 'search' ? go(state, { name: 'home' }) : state;

    case 'coursePicked':
      return from(view, 'home', 'search')
        ? go(state, { name: 'courseLoading', courseId: action.courseId })
        : state;

    // Without the id check, a slow first fetch yanks the user out of their second pick.
    case 'courseReady':
      return view.name === 'courseLoading' && view.courseId === action.courseId
        ? go(state, { name: 'course', courseId: action.courseId })
        : state;

    case 'lessonPicked':
      return from(view, 'home', 'search', 'course')
        ? go(state, { name: 'playing', courseId: action.courseId, lessonId: action.lessonId })
        : state;

    case 'lessonEnded':
      if (view.name !== 'playing') return state;
      return go(
        state,
        action.nextLessonId
          ? { name: 'playing', courseId: view.courseId, lessonId: action.nextLessonId }
          : { name: 'course', courseId: view.courseId },
      );

    case 'playerClosed':
      return view.name === 'playing'
        ? go(state, { name: 'course', courseId: view.courseId })
        : state;

    case 'wentHome':
      return from(view, 'search', 'courseLoading', 'course', 'playing')
        ? go(state, { name: 'home' })
        : state;

    case 'indexerProgressed':
      return { ...state, indexer: { done: action.done, total: action.total } };

    // Unguarded on purpose: the dev panel has to reach dead ends by hand.
    case 'jumped':
      return go(state, action.view);
  }
}

export type ViewOf<N extends ViewName> = Extract<View, { name: N }>;
