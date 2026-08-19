import type { Dispatch, ReactNode } from 'react';
import { useSettings } from './settings';
import {
  FIELDS,
  FLAIR_LEVELS,
  HOLD_MODES,
  sampleView,
  variantsFor,
  VIEW_NAMES,
  type FlairLevel,
  type HoldMode,
} from '@/lib/dev';
import type { Action, AppState, ViewName } from '@/lib/machine';
import { cn } from '@/lib/utils';

export function DevPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const { settings, setFlair, setField, setHold, setVariant, setOpen } = useSettings();
  const name = state.view.name;
  const variants = variantsFor(name);
  const variant = settings.variants[name] ?? variants[0] ?? '';

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 rule-t bg-surface/90 backdrop-blur-sm">
      <div className="flex gap-1 px-2 pt-2">
        {FIELDS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setField(f)}
            className={cn(
              'rule min-w-0 flex-1 truncate rounded-panel px-1 py-1 font-mono text-caption transition-colors duration-150 ease-panel',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
              f === settings.field
                ? 'bg-accent text-accent-ink'
                : 'bg-raised text-ink-faint hover:text-ink',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(!settings.open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 font-mono text-caption text-ink-faint transition-colors duration-150 ease-panel hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span>{settings.open ? '▾ dev' : '▸ dev'}</span>
        <span className="truncate">
          {name} · {variant} · {settings.flair}
          {settings.hold === 'hold' && ' · held'}
        </span>
      </button>

      {settings.open && (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <Field
            label="state"
            value={name}
            onChange={(next) => dispatch({ type: 'jumped', view: sampleView(next as ViewName) })}
          >
            {VIEW_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Field>

          <Field
            label={`variant · ${name}`}
            value={variant}
            onChange={(next) => setVariant(name, next)}
          >
            {variants.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Field>

          <Field label="flair" value={settings.flair} onChange={(next) => setFlair(next as FlairLevel)}>
            {FLAIR_LEVELS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Field>


          <Field
            label="transitions"
            value={settings.hold}
            onChange={(next) => setHold(next as HoldMode)}
          >
            {HOLD_MODES.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="truncate font-mono text-caption text-ink-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rule w-full rounded-panel bg-raised px-1.5 py-1 text-caption text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {children}
      </select>
    </label>
  );
}
