import { Suspense, useState } from 'react';
import { FIELD_VIEWS, FULL, MUTED, type Level } from '@/components/fields';
import { ZTM_MARK, ZTM_MARK_FONT } from '@/lib/brand';
import { FIELDS, type FieldId } from '@/lib/dev';
import { cn } from '@/lib/utils';

const LEVELS = { full: FULL, muted: MUTED } satisfies Record<string, Level>;

type LevelId = keyof typeof LEVELS;

export function Lab() {
  const [field, setField] = useState<FieldId>('snow');
  const [level, setLevel] = useState<LevelId>('full');
  const [vignette, setVignette] = useState(0.32);

  return (
    <div className="min-h-screen bg-paper p-6 font-sans text-body text-ink">
      <div className="mx-auto flex max-w-[900px] flex-col gap-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Group label="field">
            {FIELDS.map((f) => (
              <Chip key={f} on={f === field} onClick={() => setField(f)}>
                {f}
              </Chip>
            ))}
          </Group>

          <Group label="level">
            {(Object.keys(LEVELS) as LevelId[]).map((l) => (
              <Chip key={l} on={l === level} onClick={() => setLevel(l)}>
                {l}
              </Chip>
            ))}
          </Group>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-caption text-ink-faint">
              vignette {vignette.toFixed(2)}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={vignette}
              onChange={(e) => setVignette(Number(e.target.value))}
              className="w-40 accent-accent"
            />
          </label>
        </div>

        {/* The real panel's width, so nothing here reads better than it will there. */}
        <div className="rule relative h-[740px] w-[400px] overflow-hidden rounded-panel bg-paper">
          {/* Keyed so switching tears the old canvas down rather than stacking. */}
          <div key={field} className="absolute inset-0" style={{ opacity: LEVELS[level].opacity }}>
            <Suspense fallback={null}>{FIELD_VIEWS[field](LEVELS[level], () => {})}</Suspense>
          </div>

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(104% 68% at 50% 47%, rgba(14, 16, 20, ${vignette}) 0%, rgba(14, 16, 20, ${vignette * 0.7}) 34%, rgba(14, 16, 20, ${vignette * 0.28}) 62%, rgba(14, 16, 20, 0) 88%)`,
            }}
          />

          <div className="relative flex h-full flex-col items-center justify-center text-white">
            <p className="mb-1 text-caption tracking-[0.28em] uppercase opacity-80">Player for</p>
            <div className="flex items-baseline" style={{ fontFamily: ZTM_MARK_FONT }}>
              {ZTM_MARK.map(({ char, color }) => (
                <span
                  key={char}
                  style={{ color }}
                  className="text-[86px] leading-none font-black tracking-[-0.02em]"
                >
                  {char}
                </span>
              ))}
            </div>
            <p className="mt-7 text-caption opacity-80">Checking your session…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="font-mono text-caption text-ink-faint">{label}</span>
    <div className="flex gap-1.5">{children}</div>
  </div>
);

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rule rounded-panel px-2.5 py-1 text-caption transition-colors duration-150 ease-panel',
        on ? 'bg-accent text-accent-ink' : 'bg-raised text-ink-soft hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
