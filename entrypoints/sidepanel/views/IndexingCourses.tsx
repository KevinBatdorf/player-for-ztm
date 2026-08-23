import { useEffect, useState, type Dispatch } from 'react';
import { useLibrary } from '../library';
import { Button, Screen } from '../Screen';
import { useHold } from '../settings';
import type { Action } from '@/lib/machine';

export function IndexingCourses({ dispatch }: { dispatch: Dispatch<Action> }) {
  const { load, error } = useLibrary();
  const held = useHold();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (held) return;
    let live = true;

    void load().then((ready) => {
      if (live && ready) dispatch({ type: 'courseListReady' });
    });

    return () => {
      live = false;
    };
  }, [dispatch, load, held, attempt]);

  return (
    <Screen>
      {error ? (
        <>
          <p className="text-body text-ink-soft">Couldn’t load your courses.</p>
          {/* Their message, not a generic one: "the session is gone" needs a different fix. */}
          <p className="font-mono text-caption text-ink-faint">{error}</p>
          <div>
            <Button primary onClick={() => setAttempt((n) => n + 1)}>
              try again
            </Button>
          </div>
        </>
      ) : (
        <p className="text-body text-ink-soft">Loading your courses…</p>
      )}
    </Screen>
  );
}
