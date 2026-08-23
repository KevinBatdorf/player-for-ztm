// Vendored shim: `uniforms` is an index signature, which this repo's
// noUncheckedIndexedAccess widens to possibly-undefined on every lookup.
"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

export interface BlinkingDotsProps {
  /** Width of the container */
  width?: string | number;
  /** Height of the container */
  height?: string | number;
  /** Extra classes for the container */
  className?: string;
  /** Content stacked above the dot field */
  children?: ReactNode;
  /** Cells along the shortest side of the canvas */
  density?: number;
  /** Fraction of cells that hold a dot */
  coverage?: number;
  /** How far a dot may wander from its cell center */
  jitter?: number;
  /** Multiplier applied to every dot radius */
  dotSize?: number;
  /** Spread between the smallest and largest dot */
  sizeVariation?: number;
  /** Shapes the glow profile, higher values tighten the core */
  falloff?: number;
  /** Number of parallax depth layers */
  layers?: number;
  /** Cell density multiplier applied per extra layer */
  layerScale?: number;
  /** Brightness of the furthest layer */
  layerFade?: number;
  /** Color of the smallest dots */
  colorFrom?: string;
  /** Color of the largest dots */
  colorTo?: string;
  /** Fill behind the dot field, accepts "transparent" */
  backgroundColor?: string;
  /** Depth of the brightness flicker */
  twinkle?: number;
  /** Rate of the brightness flicker */
  twinkleSpeed?: number;
  /** Field pan speed in screen widths per second */
  driftSpeed?: number;
  /** Direction of the pan in degrees */
  driftAngle?: number;
  /** Strength of the radial darkening toward the edges */
  vignette?: number;
  /** Overall gain applied to the dots */
  brightness?: number;
  /** Master alpha of the canvas */
  opacity?: number;
  /** Let the pointer shift the layers */
  cursorInteraction?: boolean;
  /** How far the pointer displaces the nearest layer */
  cursorParallax?: number;
  /** Drop resolution when the frame rate falls short */
  adaptiveQuality?: boolean;
  /** Frame rate the adaptive pass aims for */
  targetFps?: number;
  /** Upper bound on device pixel ratio */
  dpr?: number;
  /** Hold the animation still */
  paused?: boolean;
}

const fieldVertex = `
varying vec2 vSpot;

void main() {
  vSpot = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fieldFragment = `
precision highp float;

varying vec2 vSpot;

uniform vec2 uCanvas;
uniform float uClock;
uniform float uDensity;
uniform float uCoverage;
uniform float uJitter;
uniform float uDotScale;
uniform float uSpread;
uniform float uFalloff;
uniform float uTiers;
uniform float uTierStep;
uniform float uTierFade;
uniform vec3 uInkLow;
uniform vec3 uInkHigh;
uniform vec3 uBackdrop;
uniform float uBackdropAlpha;
uniform float uFlicker;
uniform float uFlickerRate;
uniform vec2 uPan;
uniform vec2 uNudge;
uniform float uVignette;
uniform float uGain;
uniform float uOpacity;

vec3 scatter(vec2 seat) {
  vec3 h = fract(vec3(seat.xyx) * vec3(0.1031, 0.1030, 0.0973));
  h += dot(h, h.yzx + 33.33);
  return fract((h.xxy + h.yzz) * h.zyx);
}

void main() {
  float shortest = max(min(uCanvas.x, uCanvas.y), 1.0);
  vec2 plane = (vSpot - 0.5) * uCanvas / shortest;

  vec3 glow = vec3(0.0);
  float veil = 0.0;

  for (int tier = 0; tier < 4; tier++) {
    float rank = float(tier);
    if (rank >= uTiers) break;

    float far = rank / max(uTiers - 1.0, 1.0);
    float cells = uDensity * pow(uTierStep, rank);
    float dim = mix(1.0, uTierFade, far);
    float sway = mix(1.0, 0.3, far);

    vec2 lattice = plane * cells - (uPan + uNudge) * sway * cells + rank * 23.71;
    vec2 seat = floor(lattice);
    vec2 local = fract(lattice) - 0.5;

    vec3 roll = scatter(seat + rank * 7.31);
    vec2 slide = scatter(seat + rank * 7.31 + 41.7).xy;

    float lives = step(roll.z, uCoverage);
    float reach = (0.01 + 0.09 * mix(0.5, roll.x, uSpread)) * uDotScale;
    reach = clamp(reach, 0.002, 0.46);

    float grain = shortest / max(cells, 1.0);
    float floorReach = 0.6 / max(grain, 1.0);
    float grown = max(reach, floorReach);
    float energy = (reach * reach) / (grown * grown);

    vec2 wander = (slide - 0.5) * 2.0 * uJitter * max(0.5 - grown, 0.0);
    float gap = length(local - wander);

    float orb = 1.0 - smoothstep(0.0, grown, gap);
    orb = pow(max(orb, 0.0), uFalloff);

    float beat = sin(uClock * uFlickerRate + roll.y * 10.0);
    float lift = 1.0 - uFlicker * 0.5 + uFlicker * 0.5 * beat;

    float amp = lives * orb * energy * lift * dim;
    glow += mix(uInkLow, uInkHigh, roll.x) * amp;
    veil += amp;
  }

  glow *= uGain;
  veil = clamp(veil * uGain, 0.0, 1.0);

  float shade = 1.0 - uVignette * smoothstep(0.25, 0.95, length(plane));
  glow *= shade;
  veil *= shade;

  float rest = uBackdropAlpha * (1.0 - veil);
  vec3 rgb = glow + uBackdrop * rest;
  float alpha = veil + rest;

  gl_FragColor = vec4(rgb, alpha) * uOpacity;
}
`;

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

const subscribeToScreen = () => () => {};

const readScreenDpr = () => window.devicePixelRatio || 1;

const isClear = (paint: string) => {
  const tidy = paint.trim().toLowerCase();
  return tidy === "transparent" || tidy === "none" || tidy === "";
};

interface NudgeState {
  x: number;
  y: number;
  toX: number;
  toY: number;
}

interface FieldProps {
  awake: boolean;
  ceiling: number;
  readNudge: () => NudgeState;
  density: number;
  coverage: number;
  jitter: number;
  dotSize: number;
  sizeVariation: number;
  falloff: number;
  layers: number;
  layerScale: number;
  layerFade: number;
  colorFrom: string;
  colorTo: string;
  backgroundColor: string;
  twinkle: number;
  twinkleSpeed: number;
  driftSpeed: number;
  driftAngle: number;
  vignette: number;
  brightness: number;
  opacity: number;
  cursorInteraction: boolean;
  cursorParallax: number;
  adaptiveQuality: boolean;
  targetFps: number;
  paused: boolean;
}

const DotField = ({
  awake,
  ceiling,
  readNudge,
  density,
  coverage,
  jitter,
  dotSize,
  sizeVariation,
  falloff,
  layers,
  layerScale,
  layerFade,
  colorFrom,
  colorTo,
  backgroundColor,
  twinkle,
  twinkleSpeed,
  driftSpeed,
  driftAngle,
  vignette,
  brightness,
  opacity,
  cursorInteraction,
  cursorParallax,
  adaptiveQuality,
  targetFps,
  paused,
}: FieldProps) => {
  const { gl, invalidate, setDpr } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const elapsed = useRef(0);
  const travel = useRef(new THREE.Vector2(0, 0));
  const budget = useRef({
    scale: ceiling,
    frames: 0,
    span: 0,
    wins: 0,
    roof: Infinity,
  });
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setCalm(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const meter = budget.current;
    meter.scale = ceiling;
    meter.roof = Infinity;
    meter.wins = 0;
    setDpr(ceiling);
  }, [ceiling, setDpr]);

  const uniforms = useMemo(
    () => ({
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uClock: { value: 0 },
      uDensity: { value: 20 },
      uCoverage: { value: 0.8 },
      uJitter: { value: 0.6 },
      uDotScale: { value: 1 },
      uSpread: { value: 1 },
      uFalloff: { value: 1 },
      uTiers: { value: 2 },
      uTierStep: { value: 1.9 },
      uTierFade: { value: 0.5 },
      uInkLow: { value: new THREE.Color("#cc0080") },
      uInkHigh: { value: new THREE.Color("#ffccff") },
      uBackdrop: { value: new THREE.Color("#0a0a0a") },
      uBackdropAlpha: { value: 1 },
      uFlicker: { value: 0.4 },
      uFlickerRate: { value: 5 },
      uPan: { value: new THREE.Vector2(0, 0) },
      uNudge: { value: new THREE.Vector2(0, 0) },
      uVignette: { value: 0 },
      uGain: { value: 1 },
      uOpacity: { value: 1 },
    }),
    [],
  );

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material || !awake) return;

    const beat = Math.min(delta, 0.05);
    const still = paused || calm;
    if (!still) elapsed.current += beat;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = material.uniforms as any;
    const buffer = gl.getDrawingBufferSize(new THREE.Vector2());
    u.uCanvas.value.set(Math.max(buffer.x, 1), Math.max(buffer.y, 1));
    u.uClock.value = elapsed.current;
    u.uDensity.value = clamp(density, 2, 400);
    u.uCoverage.value = clamp(coverage, 0, 1);
    u.uJitter.value = clamp(jitter, 0, 1);
    u.uDotScale.value = clamp(dotSize, 0.05, 6);
    u.uSpread.value = clamp(sizeVariation, 0, 1);
    u.uFalloff.value = clamp(falloff, 0.25, 8);
    u.uTiers.value = clamp(Math.round(layers), 1, 4);
    u.uTierStep.value = clamp(layerScale, 1, 4);
    u.uTierFade.value = clamp(layerFade, 0, 1);
    u.uInkLow.value.set(colorFrom);
    u.uInkHigh.value.set(colorTo);
    u.uFlicker.value = clamp(twinkle, 0, 1);
    u.uFlickerRate.value = Math.max(twinkleSpeed, 0) * 5;
    u.uVignette.value = clamp(vignette, 0, 1);
    u.uGain.value = Math.max(brightness, 0);
    u.uOpacity.value = clamp(opacity, 0, 1);

    if (isClear(backgroundColor)) {
      u.uBackdropAlpha.value = 0;
    } else {
      u.uBackdropAlpha.value = 1;
      u.uBackdrop.value.set(backgroundColor);
    }

    if (!still) {
      const heading = (driftAngle * Math.PI) / 180;
      travel.current.x += Math.cos(heading) * driftSpeed * beat;
      travel.current.y += Math.sin(heading) * driftSpeed * beat;
    }
    u.uPan.value.copy(travel.current);

    const nudge = readNudge();
    nudge.x += (nudge.toX - nudge.x) * Math.min(beat * 4, 1);
    nudge.y += (nudge.toY - nudge.y) * Math.min(beat * 4, 1);
    if (cursorInteraction) {
      u.uNudge.value.set(nudge.x * cursorParallax, nudge.y * cursorParallax);
    } else {
      u.uNudge.value.set(0, 0);
    }

    const meter = budget.current;
    meter.frames += 1;
    meter.span += delta;
    if (meter.span >= 0.75) {
      const fps = meter.frames / meter.span;
      meter.frames = 0;
      meter.span = 0;
      if (adaptiveQuality && elapsed.current > 0.5) {
        if (fps < targetFps * 0.85 && meter.scale > 0.5) {
          meter.roof = meter.scale;
          meter.scale = Math.max(0.5, meter.scale * 0.75);
          meter.wins = 0;
          setDpr(meter.scale);
        } else if (fps >= targetFps * 0.95 && meter.scale < ceiling) {
          meter.wins += 1;
          const next = Math.min(ceiling, meter.scale * 1.25);
          if (meter.wins >= 3 && next < meter.roof * 0.98) {
            meter.scale = next;
            meter.wins = 0;
            setDpr(next);
          }
        } else {
          meter.wins = 0;
        }
      }
    }

    invalidate();
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={fieldVertex}
        fragmentShader={fieldFragment}
        transparent
        premultipliedAlpha
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

const BlinkingDots = ({
  width = "100%",
  height = "100%",
  className,
  children,
  density = 20,
  coverage = 0.8,
  jitter = 0.6,
  dotSize = 1,
  sizeVariation = 1,
  falloff = 1,
  layers = 2,
  layerScale = 1.9,
  layerFade = 0.5,
  colorFrom = "#cc0080",
  colorTo = "#ffccff",
  backgroundColor = "#0a0a0a",
  twinkle = 0.4,
  twinkleSpeed = 1,
  driftSpeed = 0.012,
  driftAngle = 90,
  vignette = 0,
  brightness = 1,
  opacity = 1,
  cursorInteraction = true,
  cursorParallax = 0.06,
  adaptiveQuality = true,
  targetFps = 60,
  dpr = 2,
  paused = false,
}: BlinkingDotsProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nudge = useRef<NudgeState>({ x: 0, y: 0, toX: 0, toY: 0 });
  const [awake, setAwake] = useState(false);
  const screenDpr = useSyncExternalStore(
    subscribeToScreen,
    readScreenDpr,
    () => 1,
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const watcher = new IntersectionObserver(
      ([entry]) => setAwake(entry?.isIntersecting ?? true),
      { rootMargin: "120px" },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  const readNudge = useCallback(() => nudge.current, []);

  const aimAt = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const node = rootRef.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return;
    nudge.current.toX = (event.clientX - box.left) / box.width - 0.5;
    nudge.current.toY = 0.5 - (event.clientY - box.top) / box.height;
  }, []);

  const release = useCallback(() => {
    nudge.current.toX = 0;
    nudge.current.toY = 0;
  }, []);

  const ceiling = useMemo(
    () => clamp(Math.min(screenDpr, dpr), 0.5, 2),
    [screenDpr, dpr],
  );

  return (
    <div
      ref={rootRef}
      className={cn("relative overflow-hidden", className)}
      style={{
        width,
        height,
        backgroundColor: isClear(backgroundColor) ? undefined : backgroundColor,
      }}
      onPointerMove={cursorInteraction ? aimAt : undefined}
      onPointerLeave={cursorInteraction ? release : undefined}
    >
      <Canvas
        className="absolute inset-0"
        dpr={ceiling}
        frameloop={awake ? "always" : "demand"}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
        orthographic
      >
        <DotField
          awake={awake}
          ceiling={ceiling}
          readNudge={readNudge}
          density={density}
          coverage={coverage}
          jitter={jitter}
          dotSize={dotSize}
          sizeVariation={sizeVariation}
          falloff={falloff}
          layers={layers}
          layerScale={layerScale}
          layerFade={layerFade}
          colorFrom={colorFrom}
          colorTo={colorTo}
          backgroundColor={backgroundColor}
          twinkle={twinkle}
          twinkleSpeed={twinkleSpeed}
          driftSpeed={driftSpeed}
          driftAngle={driftAngle}
          vignette={vignette}
          brightness={brightness}
          opacity={opacity}
          cursorInteraction={cursorInteraction}
          cursorParallax={cursorParallax}
          adaptiveQuality={adaptiveQuality}
          targetFps={targetFps}
          paused={paused}
        />
      </Canvas>
      {children ? (
        <div className="relative z-10 h-full w-full">{children}</div>
      ) : null}
    </div>
  );
};

export default BlinkingDots;
