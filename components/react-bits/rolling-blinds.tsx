"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";

export interface RollingBlindsProps {
  /** Spacing between the vertical blinds */
  bandWidth?: number;
  /** How fast the blinds roll across the panel */
  drift?: number;
  /** Fan of the blinds, 0 keeps them straight */
  warp?: number;
  /** Vertical lean of the light ramp */
  tilt?: number;
  /** Overall brightness */
  gain?: number;
  /** Tone response curve, above 1 deepens the shadows */
  contrast?: number;
  /** Corner falloff, 0 to 1 */
  vignette?: number;
  /** Film grain strength, 0 to 1 */
  grain?: number;
  /** Grain cell size in CSS pixels */
  grainSize?: number;
  /** Grain refreshes per second */
  grainRate?: number;
  /** Base colour of the panel */
  color?: string;
  /** Colour reached at the brightest point */
  hotColor?: string;
  /** Panel backdrop, or "transparent" to show the page through */
  backgroundColor?: string;
  /** Master alpha */
  opacity?: number;
  /** Let the light source track the pointer */
  cursorInteraction?: boolean;
  /** How far the light source follows the pointer, 0 to 1 */
  cursorShift?: number;
  /** Freeze the animation */
  paused?: boolean;
  /** Scale back resolution when the frame budget slips */
  adaptiveQuality?: boolean;
  /** Frame rate the quality meter aims to hold */
  targetFps?: number;
  /** Upper device pixel ratio bound */
  dpr?: number;
  className?: string;
  children?: ReactNode;
}

const blindsVertex = `
varying vec2 vPlane;

void main() {
  vPlane = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const blindsFragment = `
precision highp float;

varying vec2 vPlane;

uniform vec2 uCanvas;
uniform float uClock;
uniform float uBand;
uniform float uDrift;
uniform float uWarp;
uniform float uTilt;
uniform float uGain;
uniform float uContrast;
uniform float uVignette;
uniform float uGrain;
uniform float uGrainSize;
uniform float uGrainRate;
uniform vec3 uInk;
uniform vec3 uHot;
uniform vec3 uBackdrop;
uniform float uBackdropAlpha;
uniform float uOpacity;
uniform vec2 uFocus;

float scatter(vec3 seed) {
  vec3 wobble = fract(seed * vec3(0.1031, 0.1030, 0.0973));
  wobble += dot(wobble, wobble.yxz + 33.33);
  return fract((wobble.x + wobble.y) * wobble.z);
}

float silver(vec2 cell, float tick) {
  float a = scatter(vec3(cell, tick));
  float b = scatter(vec3(cell.yx + 41.7, tick + 19.3));
  return a + b - 1.0;
}

void main() {
  vec2 pixel = vPlane * uCanvas;
  float aspect = uCanvas.x / max(uCanvas.y, 1.0);
  vec2 field = (pixel - 0.5 * uCanvas) / max(uCanvas.y, 1.0);
  field -= uFocus * vec2(aspect, 1.0);

  float weave = field.x + field.x * field.y * uWarp + uClock * uDrift;
  float rung = mod(weave, max(uBand, 0.002));
  float ridge = length(field + rung);

  float tone = (1.0 - ridge + field.y * uTilt) * uGain;
  tone = pow(clamp(tone, 0.0, 1.0), max(uContrast, 0.05));

  vec2 edge = vPlane - 0.5;
  tone *= 1.0 - uVignette * dot(edge, edge) * 2.0;
  tone = clamp(tone, 0.0, 1.0);

  vec2 cell = floor(pixel / max(uGrainSize, 1.0));
  float tick = floor(uClock * max(uGrainRate, 1.0));
  float speck = silver(cell, tick) + silver(cell * 0.5 + 7.0, tick) * 0.5;
  float response = tone * (1.0 - tone) * 4.0;
  tone = clamp(tone * (1.0 + speck * uGrain * response * 1.6), 0.0, 1.0);

  vec3 tint = mix(uInk, uHot, smoothstep(0.3, 1.0, tone));
  float rest = uBackdropAlpha * (1.0 - tone);

  gl_FragColor = vec4(tint * tone + uBackdrop * rest, tone + rest) * uOpacity;
}
`;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const subscribeToScreen = (notify: () => void) => {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(min-resolution: 2dppx)");
  media.addEventListener("change", notify);
  window.addEventListener("resize", notify);
  return () => {
    media.removeEventListener("change", notify);
    window.removeEventListener("resize", notify);
  };
};

const readScreenDpr = () =>
  typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

const isClear = (paint: string) =>
  paint === "transparent" || paint === "none" || paint === "";

interface PointerState {
  x: number;
  y: number;
}

interface BlindPanelProps {
  bandWidth: number;
  drift: number;
  warp: number;
  tilt: number;
  gain: number;
  contrast: number;
  vignette: number;
  grain: number;
  grainSize: number;
  grainRate: number;
  color: string;
  hotColor: string;
  backgroundColor: string;
  opacity: number;
  cursorInteraction: boolean;
  cursorShift: number;
  paused: boolean;
  adaptiveQuality: boolean;
  targetFps: number;
  readPointer: () => PointerState;
}

const BlindPanel = ({
  bandWidth,
  drift,
  warp,
  tilt,
  gain,
  contrast,
  vignette,
  grain,
  grainSize,
  grainRate,
  color,
  hotColor,
  backgroundColor,
  opacity,
  cursorInteraction,
  cursorShift,
  paused,
  adaptiveQuality,
  targetFps,
  readPointer,
}: BlindPanelProps) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const clock = useRef(0);
  const glide = useRef({ x: 0.5, y: 0.5 });
  const budget = useRef({ frames: 0, span: 0, wins: 0 });
  const { gl, size } = useThree();

  const uniforms = useMemo(
    () => ({
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uClock: { value: 0 },
      uBand: { value: 0.1 },
      uDrift: { value: 0.2 },
      uWarp: { value: 1 },
      uTilt: { value: 0.5 },
      uGain: { value: 1 },
      uContrast: { value: 1.1 },
      uVignette: { value: 0.35 },
      uGrain: { value: 0.05 },
      uGrainSize: { value: 1 },
      uGrainRate: { value: 24 },
      uInk: { value: new THREE.Color("#334155") },
      uHot: { value: new THREE.Color("#e2e8f0") },
      uBackdrop: { value: new THREE.Color("#0a0a0a") },
      uBackdropAlpha: { value: 1 },
      uOpacity: { value: 1 },
      uFocus: { value: new THREE.Vector2(0, 0) },
    }),
    [],
  );

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uInk!.value.set(color);
    material.uniforms.uHot!.value.set(hotColor);
    const clear = isClear(backgroundColor);
    material.uniforms.uBackdropAlpha!.value = clear ? 0 : 1;
    if (!clear) material.uniforms.uBackdrop!.value.set(backgroundColor);
  }, [color, hotColor, backgroundColor]);

  // The uniform map is indexed, so this project's TS calls every one possibly undefined.
  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;

    const beat = Math.min(delta, 0.05);
    if (!paused) clock.current += beat;

    const ratio = gl.getPixelRatio();
    const set = material.uniforms;
    set.uCanvas!.value.set(size.width * ratio, size.height * ratio);
    set.uClock!.value = clock.current;
    set.uBand!.value = bandWidth;
    set.uDrift!.value = drift;
    set.uWarp!.value = warp;
    set.uTilt!.value = tilt;
    set.uGain!.value = gain;
    set.uContrast!.value = contrast;
    set.uVignette!.value = vignette;
    set.uGrain!.value = grain;
    set.uGrainSize!.value = Math.max(grainSize, 1) * ratio;
    set.uGrainRate!.value = grainRate;
    set.uOpacity!.value = opacity;

    if (cursorInteraction) {
      const pointer = readPointer();
      const ease = 1 - Math.exp(-beat * 6);
      glide.current.x += (pointer.x - glide.current.x) * ease;
      glide.current.y += (pointer.y - glide.current.y) * ease;
      set.uFocus!.value.set(
        (glide.current.x - 0.5) * cursorShift,
        (glide.current.y - 0.5) * cursorShift,
      );
    } else {
      set.uFocus!.value.set(0, 0);
    }

    if (!adaptiveQuality) return;
    const meter = budget.current;
    meter.frames += 1;
    meter.span += delta;
    if (meter.span < 0.75) return;
    const fps = meter.frames / meter.span;
    meter.frames = 0;
    meter.span = 0;
    const roof = Math.min(window.devicePixelRatio || 1, 2);
    if (fps < targetFps * 0.85 && ratio > 0.75) {
      meter.wins = 0;
      gl.setPixelRatio(Math.max(0.75, ratio * 0.75));
    } else if (fps > targetFps * 0.98 && ratio < roof) {
      meter.wins += 1;
      if (meter.wins >= 3) {
        meter.wins = 0;
        gl.setPixelRatio(Math.min(roof, ratio * 1.25));
      }
    } else {
      meter.wins = 0;
    }
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={blindsVertex}
        fragmentShader={blindsFragment}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        premultipliedAlpha
      />
    </mesh>
  );
};

export const RollingBlinds = ({
  bandWidth = 0.1,
  drift = 0.2,
  warp = 1,
  tilt = 0.5,
  gain = 1,
  contrast = 1.1,
  vignette = 0.35,
  grain = 0.05,
  grainSize = 1,
  grainRate = 24,
  color = "#334155",
  hotColor = "#e2e8f0",
  backgroundColor = "#0a0a0a",
  opacity = 1,
  cursorInteraction = true,
  cursorShift = 0.6,
  paused = false,
  adaptiveQuality = true,
  targetFps = 60,
  dpr = 2,
  className,
  children,
}: RollingBlindsProps) => {
  const shell = useRef<HTMLDivElement>(null);
  const pointer = useRef<PointerState>({ x: 0.5, y: 0.5 });
  const [awake, setAwake] = useState(true);

  const screenDpr = useSyncExternalStore(
    subscribeToScreen,
    readScreenDpr,
    () => 1,
  );
  const ceiling = Math.min(screenDpr, Math.max(dpr, 0.5));

  const readPointer = useCallback(() => pointer.current, []);

  useEffect(() => {
    const node = shell.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver(
      ([entry]) => setAwake(entry?.isIntersecting ?? true),
      { threshold: 0 },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  useEffect(() => {
    const node = shell.current;
    if (!node || !cursorInteraction) return;

    const track = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) return;
      pointer.current.x = clamp((event.clientX - box.left) / box.width, 0, 1);
      pointer.current.y = clamp(
        1 - (event.clientY - box.top) / box.height,
        0,
        1,
      );
    };

    const reset = () => {
      pointer.current.x = 0.5;
      pointer.current.y = 0.5;
    };

    node.addEventListener("pointermove", track);
    node.addEventListener("pointerleave", reset);
    return () => {
      node.removeEventListener("pointermove", track);
      node.removeEventListener("pointerleave", reset);
    };
  }, [cursorInteraction]);

  return (
    <div ref={shell} className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0">
        <Canvas
          orthographic
          dpr={ceiling}
          frameloop={awake ? "always" : "demand"}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
          }}
          // R3F writes pointer-events auto inline, which beats any class on a parent.
          style={{ pointerEvents: "none" }}
        >
          <BlindPanel
            bandWidth={bandWidth}
            drift={drift}
            warp={warp}
            tilt={tilt}
            gain={gain}
            contrast={contrast}
            vignette={vignette}
            grain={grain}
            grainSize={grainSize}
            grainRate={grainRate}
            color={color}
            hotColor={hotColor}
            backgroundColor={backgroundColor}
            opacity={opacity}
            cursorInteraction={cursorInteraction}
            cursorShift={cursorShift}
            paused={paused}
            adaptiveQuality={adaptiveQuality}
            targetFps={targetFps}
            readPointer={readPointer}
          />
        </Canvas>
      </div>
      {children ? (
        <div className="relative z-10 h-full w-full">{children}</div>
      ) : null}
    </div>
  );
};

export default RollingBlinds;
