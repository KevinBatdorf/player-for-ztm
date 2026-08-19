import { lazy, Suspense, useState, type ReactNode } from 'react';
import { asProps, defaults, KNOBS, type Values } from './knobs';
import { FIELDS, type FieldId } from '@/lib/dev';

const PixelSnow = lazy(() => import('@/components/react-bits/pixel-snow'));
const LetterGlitch = lazy(() => import('@/components/react-bits/letter-glitch'));
const GlitterWarp = lazy(() => import('@/components/react-bits/glitter-warp'));
const Landscape = lazy(() => import('@/components/react-bits/landscape'));
const FallingRays = lazy(() => import('@/components/react-bits/falling-rays'));

/**
 * Shader uniforms arrive as props, so these cannot go through CSS variables the way
 * the control-panel spec prefers; one component re-rendering per input is the cost.
 */
const render = (field: FieldId, v: Values): ReactNode => {
  const n = (k: string) => v[k] as number;
  const s = (k: string) => v[k] as string;
  const b = (k: string) => v[k] as boolean;

  if (field === 'snow')
    return (
      <PixelSnow
        color={s('color')}
        variant="square"
        density={n('density')}
        speed={n('speed')}
        brightness={n('brightness')}
        flakeSize={n('flakeSize')}
        minFlakeSize={n('minFlakeSize')}
        pixelResolution={n('pixelResolution')}
        direction={n('direction')}
        depthFade={n('depthFade')}
      />
    );

  if (field === 'glitch')
    return (
      <LetterGlitch
        glitchColors={[s('glitchColor1'), s('glitchColor2'), s('glitchColor3')]}
        glitchSpeed={n('glitchSpeed')}
        centerVignette={b('centerVignette')}
        outerVignette={b('outerVignette')}
        smooth={b('smooth')}
      />
    );

  if (field === 'warp')
    return (
      <GlitterWarp
        speed={n('speed')}
        density={n('density')}
        brightness={n('brightness')}
        starSize={n('starSize')}
        focalDepth={n('focalDepth')}
        turbulence={n('turbulence')}
        color={s('color')}
      />
    );

  if (field === 'landscape')
    return (
      // Its root sets no size, so without this the fiber canvas falls back to 300x150.
      <Landscape
        className="h-full w-full"
        speed={n('speed')}
        altitude={n('altitude')}
        pitch={n('pitch')}
        elevation={n('elevation')}
        focal={n('focal')}
        scale={n('scale')}
        fogStart={n('fogStart')}
        distance={n('distance')}
        color={s('color')}
        farColor={s('farColor')}
        ringColor={s('ringColor')}
      />
    );

  return (
    <FallingRays
      topWidth={n('topWidth')}
      bottomWidth={n('bottomWidth')}
      rayCount={n('rayCount')}
      rayWidth={n('rayWidth')}
      pulseSpeed={n('pulseSpeed')}
      pulseWidth={n('pulseWidth')}
      trailLength={n('trailLength')}
      motionBlur={n('motionBlur')}
      bgGlow={n('bgGlow')}
      color1={s('color1')}
      color2={s('color2')}
    />
  );
};

const MARK = [
  { char: 'Z', color: '#32DD88' },
  { char: 'T', color: '#FFFFFF' },
  { char: 'M', color: '#F51767' },
];

const MARK_FONT =
  "'Helvetica Now Display', 'Neue Haas Grotesk Display', Inter, 'Helvetica Neue', 'Arial Black', system-ui, sans-serif";

export function Lab() {
  const [field, setField] = useState<FieldId>('landscape');
  const [all, setAll] = useState<Record<string, Values>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f, defaults(f)])),
  );
  const [opacity, setOpacity] = useState(1);
  const [vignette, setVignette] = useState(0.32);
  const [copied, setCopied] = useState(false);

  const values = all[field] ?? {};
  const set = (key: string, value: number | string | boolean) =>
    setAll((prev) => ({ ...prev, [field]: { ...prev[field], [key]: value } }));

  const copy = () => {
    const text = `<${field}>\n${asProps(values)}\nopacity={${opacity}} vignette={${vignette}}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0b0d',
        color: '#e6e8eb',
        font: "13px/1.5 ui-sans-serif, system-ui, sans-serif",
        display: 'flex',
        gap: 24,
        padding: 24,
        alignItems: 'flex-start',
      }}
    >
      {/* The real panel's width, so nothing reads better here than it will there. */}
      <div
        style={{
          position: 'relative',
          width: 400,
          height: 740,
          flex: '0 0 auto',
          overflow: 'hidden',
          borderRadius: 8,
          border: '1px solid #1e2127',
          background: '#0E1014',
        }}
      >
        {/* Keyed so a field switch tears the old canvas down rather than stacking. */}
        <div key={field} style={{ position: 'absolute', inset: 0, opacity }}>
          <Suspense fallback={null}>{render(field, values)}</Suspense>
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(104% 68% at 50% 47%, rgba(14,16,20,${vignette}) 0%, rgba(14,16,20,${vignette * 0.7}) 34%, rgba(14,16,20,${vignette * 0.28}) 62%, rgba(14,16,20,0) 88%)`,
          }}
        />

        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '0.28em', opacity: 0.8 }}>
            PLAYER FOR
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: MARK_FONT }}>
            {MARK.map(({ char, color }) => (
              <span
                key={char}
                style={{ color, fontSize: 86, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}
              >
                {char}
              </span>
            ))}
          </div>
          <p style={{ margin: '28px 0 0', fontSize: 11, opacity: 0.8 }}>Checking your session…</p>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {FIELDS.map((f) => (
            <button key={f} type="button" onClick={() => setField(f)} style={chip(f === field)}>
              {f}
            </button>
          ))}
        </div>

        <Row label="opacity" value={opacity.toFixed(2)}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </Row>

        <Row label="vignette" value={vignette.toFixed(2)}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={vignette}
            onChange={(e) => setVignette(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </Row>

        <hr style={{ border: 0, borderTop: '1px solid #1e2127', margin: '14px 0' }} />

        {KNOBS[field].map((knob) => {
          const current = values[knob.key];
          if (knob.kind === 'range')
            return (
              <Row key={knob.key} label={knob.key} value={String(current)}>
                <input
                  type="range"
                  min={knob.min}
                  max={knob.max}
                  step={knob.step}
                  value={current as number}
                  onChange={(e) => set(knob.key, Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </Row>
            );
          if (knob.kind === 'color')
            return (
              <Row key={knob.key} label={knob.key} value={String(current)}>
                <input
                  type="color"
                  value={current as string}
                  onChange={(e) => set(knob.key, e.target.value)}
                  style={{ width: 48, height: 24, background: 'none', border: 0 }}
                />
              </Row>
            );
          return (
            <Row key={knob.key} label={knob.key} value={String(current)}>
              <input
                type="checkbox"
                checked={current as boolean}
                onChange={(e) => set(knob.key, e.target.checked)}
              />
            </Row>
          );
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={copy} style={chip(false)}>
            {copied ? 'copied' : 'copy config'}
          </button>
          <button
            type="button"
            onClick={() => setAll((p) => ({ ...p, [field]: defaults(field) }))}
            style={chip(false)}
          >
            reset
          </button>
        </div>
      </div>
    </div>
  );
}

const chip = (on: boolean) => ({
  padding: '4px 10px',
  fontSize: 11,
  fontFamily: 'ui-monospace, Menlo, monospace',
  color: on ? '#0a0b0d' : '#9ba1ac',
  background: on ? '#c792ea' : '#16181d',
  border: '1px solid #1e2127',
  borderRadius: 6,
  cursor: 'pointer',
});

const Row = ({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) => (
  <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr 68px', gap: 8, alignItems: 'center', marginBottom: 7 }}>
    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: '#9ba1ac' }}>
      {label}
    </span>
    {children}
    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: '#6b7280', textAlign: 'right' }}>
      {value}
    </span>
  </label>
);
