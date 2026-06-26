import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTerminal } from '../store';
import { REGIME_THEME, IV_STOPS } from '../theme';
import { sampleScale, hexToRgb } from '../lib/format';
import type { RegimeState } from '../types';

const W = 10; // world width (strike axis)
const D = 7; // world depth (expiry axis)
const HMAX = 3.6; // world height range (IV axis)
const IV_LO = 8;
const IV_HI = 42;

function rgbStr(s: string): [number, number, number] {
  const m = s.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return [1, 1, 1];
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
}

function SurfaceMesh() {
  const surf = useTerminal((s) => s.snap?.surface);
  const regime = (useTerminal((s) => s.snap?.regime.state) ?? 'NORMAL') as RegimeState;

  const nx = surf?.strikes.length ?? 41;
  const ny = surf?.expiries.length ?? 7;

  // Rebuild geometry only when the grid dimensions change.
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, nx - 1, ny - 1);
    const colors = new Float32Array(g.attributes.position.count * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [nx, ny]);

  const targetH = useRef<Float32Array>(new Float32Array(nx * ny));
  const accentRGB = useRef<[number, number, number]>([0.25, 0.84, 0.96]);

  // Recompute target heights whenever surface data updates.
  useMemo(() => {
    if (!surf) return;
    const arr = new Float32Array(nx * ny);
    const rough = REGIME_THEME[regime].roughness;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const iv = surf.iv[j]?.[i] ?? IV_LO;
        const t = (iv - IV_LO) / (IV_HI - IV_LO);
        const noise = rough * 0.5 * Math.sin(i * 1.7 + j * 2.3) * Math.cos(i * 0.9);
        arr[j * nx + i] = Math.max(0, Math.min(1.15, t)) * HMAX + noise;
      }
    }
    targetH.current = arr;
    accentRGB.current = rgbStr(`rgb(${hexToRgb(REGIME_THEME[regime].accent).join(',')})`);
  }, [surf, regime, nx, ny]);

  useFrame(() => {
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const col = geom.attributes.color as THREE.BufferAttribute;
    const t = targetH.current;
    let changed = false;
    for (let k = 0; k < pos.count; k++) {
      const cur = pos.getZ(k);
      const tgt = t[k] ?? 0;
      const next = cur + (tgt - cur) * 0.12; // smooth morph
      pos.setZ(k, next);
      const tt = Math.max(0, Math.min(1, next / (HMAX * 1.05)));
      const [r, g, b] = rgbStr(sampleScale(IV_STOPS, tt));
      col.setXYZ(k, r, g, b);
      if (Math.abs(tgt - cur) > 1e-4) changed = true;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    if (changed) geom.computeVertexNormals();
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Solid neon surface */}
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          metalness={0.35}
          roughness={0.35}
          emissive={new THREE.Color('#0a3d62')}
          emissiveIntensity={0.35}
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Glowing wireframe overlay (shares the morphing geometry) */}
      <mesh geometry={geom}>
        <meshBasicMaterial
          color={REGIME_THEME[regime].accent}
          wireframe
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Lights() {
  const a = useRef<THREE.PointLight>(null);
  const b = useRef<THREE.PointLight>(null);
  const regime = (useTerminal((s) => s.snap?.regime.state) ?? 'NORMAL') as RegimeState;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (a.current) {
      a.current.position.set(Math.sin(t * 0.4) * 7, 6, Math.cos(t * 0.4) * 7);
    }
    if (b.current) {
      b.current.position.set(Math.cos(t * 0.3) * -6, 4, Math.sin(t * 0.3) * 6);
    }
  });
  const accent = REGIME_THEME[regime].accent;
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight ref={a} color={accent} intensity={120} distance={40} />
      <pointLight ref={b} color="#6a4cff" intensity={80} distance={40} />
      <directionalLight position={[0, 10, 4]} intensity={0.5} />
    </>
  );
}

function FloorGlow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <planeGeometry args={[W * 2.2, D * 2.4]} />
      <meshBasicMaterial color="#06122a" transparent opacity={0.5} />
    </mesh>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    // Subtle dynamic drift so the surface "breathes".
    const t = clock.elapsedTime;
    camera.position.y = 5.4 + Math.sin(t * 0.25) * 0.4;
  });
  return null;
}

export function VolSurface() {
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [9, 5.6, 9], fov: 42 }}
        shadows
      >
        <fog attach="fog" args={['#05060d', 18, 38]} />
        <Lights />
        <FloorGlow />
        <SurfaceMesh />
        <CameraRig />
        <OrbitControls
          enablePan
          enableZoom
          autoRotate
          autoRotateSpeed={0.45}
          minDistance={7}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 0.6, 0]}
        />
      </Canvas>
    </div>
  );
}
