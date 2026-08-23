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

export type FieldLevel = 'normal' | 'muted';

export type AppState = {
  view: View;
  // The focus re-check rewinds through `boot`, unmounting `signedOut` and any flag on it.
  awaitingLogin: boolean;
  // Outside the union on purpose: it changes once per session, never per screen.
  field: FieldLevel;
};

export type Action =
  | { type: 'sessionMissing' }
  | { type: 'sessionFound' }
  | { type: 'loginOpened' }
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
  | { type: 'jumped'; view: View };

export const initialState: AppState = {
  view: { name: 'boot' },
  awaitingLogin: false,
  field: 'normal',
};

const go = (state: AppState, view: View): AppState => ({ ...state, view });

const from = (view: View, ...names: ViewName[]) => names.includes(view.name);

/** Only the dev panel asks; the real flow sets the level from the transition instead. */
const fieldOn = (name: ViewName): FieldLevel =>
  name === 'boot' || name === 'signedOut' || name === 'indexingCourses' ? 'normal' : 'muted';

// Late replies from abandoned fetches are normal, so a stray action drops silently.
export function reduce(state: AppState, action: Action): AppState {
  const { view } = state;

  switch (action.type) {
    case 'sessionMissing':
      return view.name === 'boot'
        ? { ...state, view: { name: 'signedOut' }, field: 'normal' }
        : state;

    case 'sessionFound':
      // Cleared here, or a later sign-out opens on a stale waiting notice.
      return view.name === 'boot'
        ? { ...state, view: { name: 'indexingCourses' }, awaitingLogin: false }
        : state;

    case 'loginOpened':
      return view.name === 'signedOut' ? { ...state, awaitingLogin: true } : state;

    // Checking is boot's job, so signing in rewinds there instead of skipping ahead.
    case 'signedIn':
      return view.name === 'signedOut' ? go(state, { name: 'boot' }) : state;

    case 'courseListReady':
      return view.name === 'indexingCourses'
        ? { ...state, view: { name: 'home' }, field: 'muted' }
        : state;

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

    // Unguarded on purpose: the dev panel has to reach dead ends by hand, and setting
    // the field keeps both levels reachable without walking the flow.
    case 'jumped':
      return { ...state, view: action.view, field: fieldOn(action.view.name) };
  }
}

export type ViewOf<N extends ViewName> = Extract<View, { name: N }>;

