import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTerminal } from '../store';
import { REGIME_THEME, IV_STOPS } from '../theme';
import { sampleScale } from '../lib/format';
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

function SurfaceMesh({ wireframe }: { wireframe: boolean }) {
  const surf = useTerminal((s) => s.snap?.surface);
  const regime = (useTerminal((s) => s.snap?.regime.state) ?? 'NORMAL') as RegimeState;

  const nx = surf?.strikes.length ?? 41;
  const ny = surf?.expiries.length ?? 7;

  // Higher-resolution mesh: subdivide each data cell for smoother shading.
  const SUB = 3;
  const segX = (nx - 1) * SUB;
  const segY = (ny - 1) * SUB;

  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, segX, segY);
    const colors = new Float32Array(g.attributes.position.count * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [segX, segY]);

  const targetH = useRef<Float32Array>(new Float32Array((segX + 1) * (segY + 1)));

  // Bilinear-sample the IV grid onto the dense mesh whenever data updates.
  useMemo(() => {
    if (!surf) return;
    const gw = segX + 1;
    const gh = segY + 1;
    const arr = new Float32Array(gw * gh);
    const rough = REGIME_THEME[regime].roughness;
    for (let jj = 0; jj < gh; jj++) {
      for (let ii = 0; ii < gw; ii++) {
        const fx = (ii / (gw - 1)) * (nx - 1);
        const fy = (jj / (gh - 1)) * (ny - 1);
        const i0 = Math.floor(fx), j0 = Math.floor(fy);
        const i1 = Math.min(i0 + 1, nx - 1), j1 = Math.min(j0 + 1, ny - 1);
        const tx = fx - i0, ty = fy - j0;
        const v00 = surf.iv[j0]?.[i0] ?? IV_LO;
        const v10 = surf.iv[j0]?.[i1] ?? IV_LO;
        const v01 = surf.iv[j1]?.[i0] ?? IV_LO;
        const v11 = surf.iv[j1]?.[i1] ?? IV_LO;
        const iv = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
        const t = (iv - IV_LO) / (IV_HI - IV_LO);
        const noise = rough * 0.28 * Math.sin(ii * 0.7 + jj * 0.9) * Math.cos(ii * 0.4);
        arr[jj * gw + ii] = Math.max(0, Math.min(1.15, t)) * HMAX + noise;
      }
    }
    targetH.current = arr;
  }, [surf, regime, nx, ny, segX, segY]);

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
      {/* Solid shaded surface */}
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          metalness={0.22}
          roughness={0.44}
          emissive={new THREE.Color('#000000')}
          emissiveIntensity={0}
          transparent
          opacity={wireframe ? 0.05 : 0.97}
          side={THREE.DoubleSide}
          flatShading={false}
        />
      </mesh>
      {/* Wireframe overlay (rainbow vertex colours) */}
      <mesh geometry={geom}>
        <meshBasicMaterial
          vertexColors={wireframe}
          color={wireframe ? '#ffffff' : '#ffffff'}
          wireframe
          transparent
          opacity={wireframe ? 0.85 : 0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[7, 13, 5]} intensity={1.45} color="#ffffff" />
      <directionalLight position={[-9, 5, -5]} intensity={0.3} color="#aab8d0" />
      <pointLight position={[0, 9, 0]} intensity={26} distance={42} color="#ffffff" />
    </>
  );
}

function FloorGrid() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
      <planeGeometry args={[W * 2.4, D * 2.6]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.85} />
    </mesh>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    camera.position.y = 5.4 + Math.sin(t * 0.2) * 0.3;
  });
  return null;
}

export function VolSurface({ wireframe = false }: { wireframe?: boolean }) {
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [9, 5.6, 9], fov: 42 }}
        shadows
      >
        <fog attach="fog" args={['#000000', 20, 42]} />
        <Lights />
        <FloorGrid />
        <SurfaceMesh wireframe={wireframe} />
        <CameraRig />
        <OrbitControls
          enablePan
          enableZoom
          autoRotate
          autoRotateSpeed={0.18}
          minDistance={7}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 0.6, 0]}
        />
      </Canvas>
    </div>
  );
}
