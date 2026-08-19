/**
 * ZTM's own colours, read off zerotomastery.io and the academy origin. The purple
 * fills their logo path, the pink is the site's `theme-color`, and the green is
 * their CTA heading colour. Trustpilot's `#00B67A` sits in star paths on the same
 * page and is not theirs.
 */
export const ZTM_PURPLE = '#4C0FFB';
export const ZTM_PINK = '#F51767';
export const ZTM_GREEN = '#32DD88';

/** The splash keeps its own ground: a branded launch screen, not a themed one. */
export const ZTM_GROUND = '#0E1014';

/** Resolves to Helvetica Neue Black on macOS; each fallback is a heaviest-cut family. */
export const ZTM_MARK_FONT =
  "'Helvetica Now Display', 'Neue Haas Grotesk Display', Inter, 'Helvetica Neue', 'Arial Black', system-ui, sans-serif";

/** Their name, one colour per letter. */
export const ZTM_MARK = [
  { char: 'Z', color: ZTM_GREEN },
  { char: 'T', color: '#FFFFFF' },
  { char: 'M', color: ZTM_PINK },
] as const;
