import { lazy, Suspense, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A bundled chunk rather than remote code, so MV3 is fine with it. */
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
    <div className="flex h-full flex-col">
      {(title || onBack) && (
        <header className="rule-b flex shrink-0 items-center gap-3 px-6 py-3.5">
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pt-4 pb-6">{children}</div>
    </div>
  );
}

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
  const Tag = as;

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

export const Cta = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <Button className="w-full shadow-panel active:translate-y-px" onClick={onClick}>
    {children}
  </Button>
);

export function Row({
  title,
  meta,
  onClick,
  /** Picking a lesson does not change screen, so the list shows which one is loaded. */
  active = false,
  done = false,
  onPointerEnter,
  onPointerLeave,
}: {
  title: string;
  meta?: string;
  onClick: () => void;
  active?: boolean;
  done?: boolean;
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
        'rule flex w-full items-baseline justify-between gap-2 rounded-panel bg-card px-3 py-2.5 text-left transition-colors duration-150 ease-panel',
        'hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
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
      {done && (
        <span className="shrink-0 font-mono text-caption text-accent-text" title="Watched">
          &#10003;
        </span>
      )}
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
    <div className="group rule relative flex w-full items-baseline justify-between gap-2 rounded-panel bg-card/60 px-3 py-2.5">
      <span className="min-w-0 flex-1 text-body leading-snug text-ink-soft">{title}</span>
      <span className="shrink-0 font-mono text-caption text-ink-faint">text</span>

      <div className="pointer-events-none absolute inset-0 flex items-center gap-1.5 rounded-panel bg-card-hover px-3 opacity-0 transition-opacity duration-150 ease-panel group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <Button variant="silver" size="xs" onClick={onRead}>
          read here
        </Button>
        <Button variant="silver" size="xs" onClick={onOpenTab}>
          open tab
        </Button>
      </div>
    </div>
  );
}
