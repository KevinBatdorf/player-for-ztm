import { useEffect, useState } from 'react';
import List1 from '@/components/blocks/list-1';
import { applyTheme, DEFAULT_THEME, THEMES, type ThemeId } from '@/lib/themes';

// Throwaway probe. Delete it rather than building the real panel on top of it.
export function ToolchainProof() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => applyTheme(theme), [theme]);

  return (
    <div className="flex h-screen flex-col bg-paper font-sans text-body text-ink">
      <header className="rule-b flex shrink-0 flex-col gap-2 bg-surface p-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-display font-semibold tracking-tight">ZTM Sidebar</h1>
          <span className="text-caption text-ink-faint">phase 0</span>
        </div>

        <div className="flex gap-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={[
                'rule flex-1 rounded-panel px-2 py-1.5 text-caption transition-colors duration-150',
                'ease-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                t.id === theme
                  ? 'bg-accent text-accent-ink shadow-panel'
                  : 'bg-raised text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-caption text-ink-soft">
          Every surface below reads the same token block. The list is{' '}
          <code className="font-mono text-accent">@reactbits-pro/list-1</code>, harmonized onto it.
        </p>
      </header>

      {/* App UI blocks are h-full; their scroll areas collapse without a parent height. */}
      <div className="min-h-0 flex-1">
        <List1 />
      </div>
    </div>
  );
}
