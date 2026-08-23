/** Darker than the sheet, or the boundary between them cannot be seen. */
export const DotGrid = () => (
  <div
    className="pointer-events-none absolute inset-0 bg-canvas"
    style={{
      backgroundImage: 'radial-gradient(circle, var(--t-dot) 1px, transparent 1px)',
      backgroundSize: '12px 12px',
      backgroundPosition: '-1px -1px',
    }}
  />
);
