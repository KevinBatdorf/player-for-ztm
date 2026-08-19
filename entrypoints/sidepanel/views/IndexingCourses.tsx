import type { Dispatch } from 'react';
import { Button, Screen, Simulate, StubNote } from '../Screen';
import type { Action } from '@/lib/machine';

export function IndexingCourses({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <Screen title="Player for ZTM">
      <p className="text-body text-ink-soft">Loading your courses…</p>
      <StubNote>
        Phase 3 fetches the course list on every open, since courses get added and titles
        get edited. This is the only screen in the app that blocks, and only while the
        cache is empty.
      </StubNote>
      <Simulate>
        <Button primary onClick={() => dispatch({ type: 'courseListReady' })}>
          list ready
        </Button>
      </Simulate>
    </Screen>
  );
}
