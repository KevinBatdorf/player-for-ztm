import { ArrowLeft, Check, FileText } from 'lucide-react';
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
        <header className="rule-b shrink-0 px-6 pt-3.5 pb-4">
          {onBack && (
            <Button variant="silver" size="xs" onClick={onBack} className="mb-3">
              <ArrowLeft aria-hidden />
              back
            </Button>
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

/** Zero to one fraction rather than a height, so the row opens without a measurement. */
const DRAWER = [
  'grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-panel',
  'group-hover:grid-rows-[1fr]',
  // A click leaves focus behind, and focus-within would hold the row open after the pointer goes.
  'group-has-[:focus-visible]:grid-rows-[1fr]',
].join(' ');

export function Row({
  title,
  meta,
  onClick,
  onPlay,
  onQueue,
  /** Picking a lesson does not change screen, so the list shows which one is loaded. */
  active = false,
  done = false,
  queued = false,
  canQueue = true,
  onPointerEnter,
  onPointerLeave,
}: {
  title: string;
  meta?: string;
  onClick: () => void;
  onPlay: () => void;
  onQueue: () => void;
  active?: boolean;
  done?: boolean;
  queued?: boolean;
  canQueue?: boolean;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="group rule relative flex w-full flex-col rounded-panel bg-card px-3 py-2.5 text-left transition-colors duration-150 ease-panel hover:bg-card-hover"
    >
      {/* Under the actions rather than around them: a button cannot hold another. */}
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        className="absolute inset-0 rounded-panel focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      />

      <div className="pointer-events-none relative flex items-center justify-between gap-2">
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-body leading-snug',
            active ? 'font-medium text-accent-text' : 'text-ink',
          )}
        >
          {title}
        </span>
        {queued && (
          <span className="shrink-0 font-mono text-caption text-ink-soft">queued</span>
        )}
        {done && (
          <span className="shrink-0 font-mono text-caption text-accent-text" title="Watched">
            &#10003;
          </span>
        )}
        {meta && <span className="shrink-0 font-mono text-caption text-ink-faint">{meta}</span>}
      </div>

      <div className={cn('relative', DRAWER)}>
        <div className="overflow-hidden">
          <div className="flex gap-1.5 pt-2">
            <Button variant="silver" size="xs" onClick={onPlay}>
              play
            </Button>
            <Button variant="silver" size="xs" onClick={onQueue} disabled={!canQueue}>
              {queued && <Check aria-hidden />}
              {queued ? 'queued' : 'play next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TextRow({
  title,
  done = false,
  onRead,
  onOpenTab,
}: {
  title: string;
  done?: boolean;
  onRead: () => void;
  onOpenTab: () => void;
}) {
  return (
    <div className="group rule flex w-full flex-col rounded-panel bg-card/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-body leading-snug text-ink-soft">{title}</span>
        {done && (
          <span className="shrink-0 font-mono text-caption text-accent-text" title="Read">
            &#10003;
          </span>
        )}
        <FileText className="size-3.5 shrink-0 text-ink-faint" aria-label="Text lesson" />
      </div>

      <div className={DRAWER}>
        <div className="overflow-hidden">
          <div className="flex gap-1.5 pt-2">
            <Button variant="silver" size="xs" onClick={onRead}>
              read here
            </Button>
            <Button variant="silver" size="xs" onClick={onOpenTab}>
              open tab
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
