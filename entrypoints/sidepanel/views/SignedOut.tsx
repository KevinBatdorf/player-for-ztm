import type { Dispatch } from 'react';
import { Button, Screen, StubNote } from '../Screen';
import type { Action } from '@/lib/machine';

export function SignedOut({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <Screen title="Sign in">
      <p className="text-body text-ink">You are signed out of Zero To Mastery.</p>
      <StubNote>
        ZTM emails a one-time code, so this is a prompt rather than a form. Phase 2 opens a
        real tab and re-checks the session when the panel regains focus; the button below
        stands in for that round trip.
      </StubNote>
      <div className="flex">
        <Button primary onClick={() => dispatch({ type: 'signedIn' })}>
          Open ZTM to sign in
        </Button>
      </div>
    </Screen>
  );
}
