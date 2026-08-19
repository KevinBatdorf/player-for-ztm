import type { Dispatch } from 'react';
import { Button, Screen, Simulate, StubNote } from '../Screen';
import type { Action } from '@/lib/machine';

export function Boot({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <Screen title="Player for ZTM">
      <p className="text-body text-ink-soft">Checking your ZTM session…</p>
      <StubNote>
        Phase 2 does this for real. Detection reads page content rather than cookies —{' '}
        <code className="font-mono text-ink-soft">_session_id</code> and{' '}
        <code className="font-mono text-ink-soft">cf_clearance</code> are both set while signed
        out.
      </StubNote>
      <Simulate>
        <Button primary onClick={() => dispatch({ type: 'sessionFound' })}>
          session found
        </Button>
        <Button onClick={() => dispatch({ type: 'sessionMissing' })}>no session</Button>
      </Simulate>
    </Screen>
  );
}
