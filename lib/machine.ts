/** ZTM's own ids, as they appear in course and lesson URLs. */
export type CourseId = string;
export type LessonId = string;

export type View =
  | { name: 'boot' }
  | { name: 'signedOut' }
  | { name: 'indexingCourses' }
  | { name: 'home' }
  | { name: 'courseLoading'; courseId: CourseId }
  | { name: 'course'; courseId: CourseId };

export type ViewName = View['name'];

/** The screens reached after sign-in. The player mounts on these; the backdrop mutes on them. */
export const inside = (name: ViewName): boolean =>
  name === 'home' || name === 'courseLoading' || name === 'course';

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
  /** Jumps the queue when the playing lesson ends, in place of the one that follows it. */
  queued: Loaded | null;
  /** Rises on every asked-for play; the player reads the change, never the number. */
  insist: number;
  heading: Heading;
};

export type Action =
  | { type: 'sessionMissing' }
  | { type: 'sessionFound' }
  | { type: 'loginOpened' }
  | { type: 'signedIn' }
  | { type: 'courseListReady' }
  | { type: 'coursePicked'; courseId: CourseId }
  | { type: 'courseReady'; courseId: CourseId }
  | { type: 'lessonPicked'; courseId: CourseId; lessonId: LessonId }
  | { type: 'lessonPlayed'; courseId: CourseId; lessonId: LessonId }
  | { type: 'lessonQueued'; courseId: CourseId; lessonId: LessonId }
  | { type: 'lessonEnded'; nextLessonId: LessonId | null }
  | { type: 'lessonHandedOff' }
  | { type: 'wentHome' };

export const initialState: AppState = {
  view: { name: 'boot' },
  awaitingLogin: false,
  backdrop: 'normal',
  lesson: null,
  queued: null,
  insist: 0,
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

    case 'coursePicked':
      return view.name === 'home'
        ? go(state, { name: 'courseLoading', courseId: action.courseId }, 'in')
        : state;

    // Without the id check, a slow first fetch yanks the user out of their second pick.
    case 'courseReady':
      return view.name === 'courseLoading' && view.courseId === action.courseId
        ? go(state, { name: 'course', courseId: action.courseId })
        : state;

    // Loads the player and leaves the screen alone; the list is still worth reading.
    case 'lessonPicked': {
      if (!from(view, 'home', 'course')) return state;
      const lesson = { courseId: action.courseId, lessonId: action.lessonId };
      const held = state.queued;
      // Playing the queued one by hand is the queue spent, not a queue still waiting.
      const queued = held && held.lessonId === lesson.lessonId ? null : held;
      return { ...state, lesson, queued };
    }

    case 'lessonPlayed': {
      if (!from(view, 'home', 'course')) return state;
      const lesson = { courseId: action.courseId, lessonId: action.lessonId };
      const held = state.queued;
      const queued = held && held.lessonId === lesson.lessonId ? null : held;
      return { ...state, lesson, queued, insist: state.insist + 1 };
    }

    case 'lessonQueued': {
      const held = state.queued;
      const same = held?.courseId === action.courseId && held.lessonId === action.lessonId;
      return {
        ...state,
        queued: same ? null : { courseId: action.courseId, lessonId: action.lessonId },
      };
    }

    // No next lesson means the video rests on its last frame; there is nowhere to send anyone.
    case 'lessonEnded': {
      if (!state.lesson) return state;
      const after =
        state.queued ??
        (action.nextLessonId ? { ...state.lesson, lessonId: action.nextLessonId } : null);
      return after ? { ...state, lesson: after, queued: null } : state;
    }

    // Two documents on one lesson play it twice, so the panel lets go.
    case 'lessonHandedOff':
      return { ...state, lesson: null, queued: null };

    case 'wentHome':
      return from(view, 'courseLoading', 'course')
        ? go(state, { name: 'home' }, 'out')
        : state;
  }
}

export type ViewOf<N extends ViewName> = Extract<View, { name: N }>;
