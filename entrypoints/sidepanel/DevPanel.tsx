import type { Dispatch } from 'react';
import { useLibrary } from './library';
import { useSettings } from './settings';
import { sampleView, VIEW_NAMES } from '@/lib/dev';
import type { Action, AppState, ViewName } from '@/lib/machine';

export function DevPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const { settings, setHeld, setOpen } = useSettings();
  const { courses } = useLibrary();
  const name = state.view.name;

  return (
    <div className="relative z-50 shrink-0 rule-t bg-surface/90 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen(!settings.open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 font-mono text-caption text-ink-faint transition-colors duration-150 ease-panel hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span>{settings.open ? '▾ dev' : '▸ dev'}</span>
        <span className="truncate">
          {name}
          {settings.held && ' · held'}
        </span>
      </button>

      {settings.open && (
        <div className="flex items-end gap-3 px-3 pb-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-mono text-caption text-ink-faint">state</span>
            <select
              value={name}
              onChange={(e) =>
                dispatch({
                  type: 'jumped',
                  view: sampleView(e.target.value as ViewName, courses?.[0]?.id ?? ''),
                })
              }
              className="rule w-full rounded-panel bg-raised px-1.5 py-1 text-caption text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {VIEW_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="flex shrink-0 items-center gap-1.5 py-1 font-mono text-caption text-ink-faint">
            <input
              type="checkbox"
              checked={settings.held}
              onChange={(e) => setHeld(e.target.checked)}
              className="accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            hold transitions
          </label>
        </div>
      )}
    </div>
  );
}
