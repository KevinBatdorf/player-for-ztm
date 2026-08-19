import type { Dispatch, ReactNode } from 'react';
import { useSettings } from './settings';
import { FLAIR_LEVELS, sampleView, variantsFor, VIEW_NAMES, type FlairLevel } from '@/lib/dev';
import type { Action, AppState, ViewName } from '@/lib/machine';
import { THEMES, type ThemeId } from '@/lib/themes';

// Theme is a real user setting, hosted here only until there is a settings screen.
export function DevPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const { settings, setTheme, setFlair, setVariant, setOpen } = useSettings();
  const name = state.view.name;
  const variants = variantsFor(name);
  const variant = settings.variants[name] ?? variants[0] ?? '';

  return (
    <div className="rule-t shrink-0 bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!settings.open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 font-mono text-caption text-ink-faint transition-colors duration-150 ease-panel hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span>{settings.open ? '▾ dev' : '▸ dev'}</span>
        <span className="truncate">
          {name} · {settings.theme} · {variant} · {settings.flair}
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

          <Field label="theme" value={settings.theme} onChange={(next) => setTheme(next as ThemeId)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
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
