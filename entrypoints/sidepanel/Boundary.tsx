import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { fault: string | null };

/** A thrown render leaves an empty panel and no way to see what threw. */
export class Boundary extends Component<{ children: ReactNode }, State> {
  override state: State = { fault: null };

  static getDerivedStateFromError(cause: unknown): State {
    return { fault: cause instanceof Error ? `${cause.message}\n\n${cause.stack ?? ''}` : String(cause) };
  }

  override componentDidCatch(cause: Error, info: ErrorInfo) {
    console.error('[ztm]', cause, info.componentStack);
  }

  override render() {
    if (!this.state.fault) return this.props.children;

    return (
      <div className="flex h-screen flex-col gap-3 overflow-y-auto bg-paper px-6 py-6 font-sans">
        <p className="text-heading font-medium text-ink">The panel stopped.</p>
        <pre className="font-mono text-caption leading-relaxed whitespace-pre-wrap text-ink-soft">
          {this.state.fault}
        </pre>
      </div>
    );
  }
}
