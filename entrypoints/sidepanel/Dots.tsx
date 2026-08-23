import { lazy, Suspense } from 'react';
import { useFlair } from './settings';

const BlinkingDots = lazy(() => import('@/components/react-bits/blinking-dots'));

/** A second GL context on top of the landscape, so keep it off the sign-in screens. */
export function Dots() {
  const flair = useFlair();

  return (
    <div className="pointer-events-none absolute inset-0">
      <Suspense fallback={null}>
        <BlinkingDots
          className="h-full w-full"
          backgroundColor="transparent"
          density={20}
          coverage={0.5}
          jitter={0.35}
          dotSize={0.8}
          sizeVariation={0.7}
          layers={2}
          layerFade={0.5}
          colorFrom="#4C0FFB"
          colorTo="#C792EA"
          twinkle={flair === 'full' ? 0.75 : 0.45}
          twinkleSpeed={0.3}
          driftSpeed={0.012}
          driftAngle={200}
          vignette={0.18}
          brightness={1.15}
          opacity={0.9}
          // Defaults to true in the vendored component.
          cursorInteraction={false}
          paused={flair === 'none'}
        />
      </Suspense>
    </div>
  );
}
