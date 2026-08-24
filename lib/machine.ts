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
  | { name: 'course'; courseId: CourseId };

export type ViewName = View['name'];

/** The screens reached after sign-in. The player mounts on these; the backdrop mutes on them. */
export const inside = (name: ViewName): boolean =>
  name === 'home' || name === 'search' || name === 'courseLoading' || name === 'course';

export type BackdropLevel = 'normal' | 'muted';

/** `none` is a progression nobody navigated; it fades instead of sliding. */
export type Heading = 'in' | 'out' | 'none';

export type Loaded = { courseId: CourseId; lessonId: LessonId };

export type AppState = {
  view: View;
  // The focus re-check rewinds through `boot`, unmounting `signedOut` and any flag on it.
  awaitingLogin: boolean;
  // Outside the union on purpose: it changes once per session, never per screen.
  backdrop: BackdropLevel;
  // Ambient so a screen change cannot clear a loaded lesson.
  lesson: Loaded | null;
  heading: Heading;
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
  | { type: 'wentHome' };

export const initialState: AppState = {
  view: { name: 'boot' },
  awaitingLogin: false,
  backdrop: 'normal',
  lesson: null,
  heading: 'none',
};

const go = (state: AppState, view: View, heading: Heading = 'none'): AppState => ({
  ...state,
  view,
  heading,
});

const from = (view: View, ...names: ViewName[]) => names.includes(view.name);

// Late replies from abandoned fetches are normal, so a stray action drops silently.
export function reduce(state: AppState, action: Action): AppState {
  const { view } = state;

  switch (action.type) {
    case 'sessionMissing':
      return view.name === 'boot'
        ? { ...go(state, { name: 'signedOut' }), backdrop: 'normal' }
        : state;

    case 'sessionFound':
      // Cleared here, or a later sign-out opens on a stale waiting notice.
      return view.name === 'boot'
        ? { ...go(state, { name: 'indexingCourses' }), awaitingLogin: false }
        : state;

    case 'loginOpened':
      return view.name === 'signedOut' ? { ...state, awaitingLogin: true } : state;

    // Checking is boot's job, so signing in rewinds there instead of skipping ahead.
    case 'signedIn':
      return view.name === 'signedOut' ? go(state, { name: 'boot' }) : state;

    case 'courseListReady':
      return view.name === 'indexingCourses'
        ? { ...go(state, { name: 'home' }), backdrop: 'muted' }
        : state;

    case 'searchOpened':
      return view.name === 'home' ? go(state, { name: 'search', query: '' }, 'in') : state;

    case 'searchChanged':
      return view.name === 'search' ? go(state, { name: 'search', query: action.query }) : state;

    case 'searchClosed':
      return view.name === 'search' ? go(state, { name: 'home' }, 'out') : state;

    case 'coursePicked':
      return from(view, 'home', 'search')
        ? go(state, { name: 'courseLoading', courseId: action.courseId }, 'in')
        : state;

    // Without the id check, a slow first fetch yanks the user out of their second pick.
    case 'courseReady':
      return view.name === 'courseLoading' && view.courseId === action.courseId
        ? go(state, { name: 'course', courseId: action.courseId })
        : state;

    // Loads the player and leaves the screen alone; the list is still worth reading.
    case 'lessonPicked':
      return from(view, 'home', 'search', 'course')
        ? { ...state, lesson: { courseId: action.courseId, lessonId: action.lessonId } }
        : state;

    // No next lesson means the video rests on its last frame; there is nowhere to send anyone.
    case 'lessonEnded':
      return state.lesson && action.nextLessonId
        ? { ...state, lesson: { ...state.lesson, lessonId: action.nextLessonId } }
        : state;

    case 'playerClosed':
      return { ...state, lesson: null };

    case 'wentHome':
      return from(view, 'search', 'courseLoading', 'course')
        ? go(state, { name: 'home' }, 'out')
        : state;
  }
}

export type ViewOf<N extends ViewName> = Extract<View, { name: N }>;
