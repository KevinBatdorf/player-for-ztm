import { lazy, Suspense, type ReactNode } from 'react';
import { useFlair } from './settings';
import { cn } from '@/lib/utils';

/**
 * Split out because motion is 124KB and only `flair: full` ever renders it, which
 * keeps the default open at the 246KB it costs without. A bundled chunk, not
 * remote code, so MV3 is fine with it.
 */
const StaggeredText = lazy(() => import('@/components/react-bits/staggered-text'));

// Plain on purpose: real panel furniture gets designed against real content.
// Translucent so the app's field reads in the gutters; rows stay opaque over it.
export function Screen({
  title,
  onBack,
  children,
}: {
  /** Only a title naming where you are; the app's own name buys nothing at 400px. */
  title?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-paper/60">
      {(title || onBack) && (
        <header className="rule-b flex shrink-0 items-center gap-2 bg-surface px-4 py-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="rule rounded-panel px-1.5 py-0.5 text-caption text-ink-soft transition-colors duration-150 ease-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              &larr;
            </button>
          )}
          {title && <h1 className="text-heading leading-snug font-medium text-ink">{title}</h1>}
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

/** The one gate on flair for type; every screen's heading goes through it. */
export function Reveal({
  text,
  as = 'h1',
  align = 'start',
  blur = true,
  duration = 0.45,
  className,
}: {
  text: string;
  as?: 'h1' | 'h2' | 'p' | 'span';
  align?: 'start' | 'center';
  /** A filter on the spans breaks any `background-clip: text` clipping through them. */
  blur?: boolean;
  /** Three one-letter instances land in sequence when each is given its own. */
  duration?: number;
  className?: string;
}) {
  const flair = useFlair();
  const Tag = as;

  if (flair !== 'full') return <Tag className={className}>{text}</Tag>;

  return (
    // A visible fallback shows the finished heading, then rewinds it to animate.
    <Suspense fallback={<Tag className={cn(className, 'invisible')}>{text}</Tag>}>
      <StaggeredText
        as={as}
        text={text}
        // Its own wrapper is a flex row, so alignment has to travel in the class.
        className={cn(align === 'center' ? 'justify-center' : 'justify-start', className)}
        segmentBy="chars"
        delay={34}
        duration={duration}
        direction="bottom"
        blur={blur}
      />
    </Suspense>
  );
}

export function Cta({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rule w-full rounded-panel bg-accent px-3 py-2 text-body font-medium text-accent-ink shadow-panel transition-transform duration-150 ease-panel active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

export const StubNote = ({ children }: { children: ReactNode }) => (
  <p className="text-caption leading-relaxed text-ink-faint">{children}</p>
);

/** Stands in for transitions nothing raises yet, so the flow is walkable by hand. */
export const Simulate = ({ children }: { children: ReactNode }) => (
  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-dashed border-line pt-3">
    <span className="w-full font-mono text-caption text-ink-faint">simulate</span>
    {children}
  </div>
);

export function Button({
  children,
  onClick,
  primary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rule rounded-panel px-2.5 py-1.5 text-caption transition-colors duration-150 ease-panel',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        primary
          ? 'bg-accent text-accent-ink shadow-panel'
          : 'bg-raised text-ink-soft hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export function Row({
  title,
  meta,
  onClick,
  /** Picking a lesson does not change screen, so the list shows which one is loaded. */
  active = false,
  onPointerEnter,
  onPointerLeave,
}: {
  title: string;
  meta?: string;
  onClick: () => void;
  active?: boolean;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={cn(
        'rule flex w-full items-baseline justify-between gap-2 rounded-panel bg-raised px-3 py-2 text-left transition-colors duration-150 ease-panel',
        'hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active && 'bg-surface',
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 text-body leading-snug',
          active ? 'font-medium text-accent-text' : 'text-ink',
        )}
      >
        {title}
      </span>
      {meta && <span className="shrink-0 font-mono text-caption text-ink-faint">{meta}</span>}
    </button>
  );
}

/** Focus-within is what keeps the two actions reachable without a pointer. */
export function TextRow({
  title,
  onRead,
  onOpenTab,
}: {
  title: string;
  onRead: () => void;
  onOpenTab: () => void;
}) {
  return (
    <div className="group rule relative flex w-full items-baseline justify-between gap-2 rounded-panel bg-raised/40 px-3 py-2">
      <span className="min-w-0 flex-1 text-body leading-snug text-ink-soft">{title}</span>
      <span className="shrink-0 font-mono text-caption text-ink-faint">text</span>

      <div className="pointer-events-none absolute inset-0 flex items-center gap-1.5 rounded-panel bg-surface px-3 opacity-0 transition-opacity duration-150 ease-panel group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <Button primary onClick={onRead}>
          read here
        </Button>
        <Button onClick={onOpenTab}>open tab</Button>
      </div>
    </div>
  );
}
