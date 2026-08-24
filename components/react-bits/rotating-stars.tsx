"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uCenter;
  uniform float uScale;
  uniform float uSpeed;
  uniform vec3 uColor;
  uniform float uThickness;
  uniform float uSoftness;
  uniform float uRoundness;

  varying vec2 vUv;

  #define PI 3.14159265359

  float rand(float t) {
    return fract(sin(dot(vec2(t, t), vec2(12.9898, 78.233))) * 43758.5453);
  }

  float sdRoundedBox(vec2 p, vec2 b, vec4 r) {
    r.xy = (p.x > 0.0) ? r.xy : r.zw;
    r.x  = (p.y > 0.0) ? r.x  : r.y;
    vec2 q = abs(p) - b + r.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
  }

  void main() {
    float time = uTime * uSpeed;
    vec2 uv = (vUv * 2.0 - 1.0) * uResolution / uResolution.y;
    vec2 uv1 = uv - uCenter;

    float r = length(uv1) * uScale;
    float t = ceil(r);

    float effectiveTime = time * rand(t) * 0.1 + t * 0.1;
    float angle = atan(uv1.y, uv1.x) / PI;
    float a = fract(angle + effectiveTime);

    float startAng = rand(t);
    float da = fract(a - startAng + 0.5) - 0.5;

    float x = da * 5.0;
    float y = r - t + 0.5;
    vec2 p = vec2(x, y);

    vec2 boxSize = vec2(0.75, uThickness * 0.5);
    float radius = min(boxSize.x, boxSize.y) * uRoundness;
    float d = sdRoundedBox(p, boxSize, vec4(radius));

    float softness = max(uSoftness, 0.001);
    float mask = 1.0 - smoothstep(0.0, softness, d);

    float ringMask = smoothstep(0.1, 0.11, r / uScale);

    vec3 col = uColor * 3.0 * rand(t);

    gl_FragColor = vec4(col, mask * ringMask);
  }
`;

interface SceneProps {
  center: [number, number];
  scale: number;
  speed: number;
  color: string;
  thickness: number;
  softness: number;
  roundness: number;
}

const Scene: React.FC<SceneProps> = ({
  center,
  scale,
  speed,
  color,
  thickness,
  softness,
  roundness,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uCenter: { value: new THREE.Vector2(center[0], center[1]) },
      uScale: { value: scale },
      uSpeed: { value: speed },
      uColor: { value: new THREE.Color(color) },
      uThickness: { value: thickness },
      uSoftness: { value: softness },
      uRoundness: { value: roundness },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state) => {
    // The uniform map is indexed, so this project's TS calls every one possibly undefined.
    const uniforms = materialRef.current?.uniforms;
    if (!uniforms) return;

    uniforms.uTime!.value = state.clock.elapsedTime;
    uniforms.uResolution!.value.set(size.width, size.height);
    uniforms.uCenter!.value.set(center[0], center[1]);
    uniforms.uScale!.value = scale;
    uniforms.uSpeed!.value = speed;
    uniforms.uColor!.value.set(color);
    uniforms.uThickness!.value = thickness;
    uniforms.uSoftness!.value = softness;
    uniforms.uRoundness!.value = roundness;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
};

export interface RotatingStarsProps {
  x?: number;
  y?: number;
  radius?: number;
  speed?: number;
  color?: string;
  thickness?: number;
  softness?: number;
  roundness?: number;
  className?: string;
}

const RotatingStars: React.FC<RotatingStarsProps> = ({
  x = 0,
  y = 0,
  radius = 15,
  speed = 1.5,
  color = "#8b5cf6",
  thickness = 0.01,
  softness = 0.1,
  roundness = 1,
  className = "",
}) => {
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Scene
          center={[x, y]}
          scale={radius}
          speed={speed}
          color={color}
          thickness={thickness}
          softness={softness}
          roundness={roundness}
        />
      </Canvas>
    </div>
  );
};

export default RotatingStars;
