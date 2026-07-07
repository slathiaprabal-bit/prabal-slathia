import { memo, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useVolSnap, useReplay } from '../lib/vol/replay';
import { useVolSelection } from '../lib/vol/selection';
import { gridRange } from '../lib/vol/scale';
import { IV_STOPS } from '../theme';
import { sampleScale } from '../lib/format';
import { bs } from '../lib/adjust/bs';
import type { Surface } from '../types';

// ── world geometry ──
const W = 10;      // strike axis width
const D = 7;       // expiry axis depth
const HMAX = 3.2;  // IV axis height

export type CameraPreset = 'PERSPECTIVE' | 'TOP' | 'SMILE' | 'TERM' | 'SKEW';
const PRESET_POS: Record<CameraPreset, [number, number, number]> = {
  PERSPECTIVE: [8.2, 5.0, 8.2],  // institutional 3/4 view
  TOP: [0, 12.5, 0.001],         // heatmap-style skew map from above
  SMILE: [0, 2.4, 10.6],         // strikes across — read the smile
  TERM: [10.6, 2.4, 0],          // maturities across — read the term curve
  SKEW: [-4.2, 3.0, 10.2],       // off-axis from the put wing — wing asymmetry
};

export type XAxisMode = 'STRIKE' | 'MONEYNESS';
const xTickLabel = (k: number, spot: number, mode: XAxisMode) => {
  if (mode === 'STRIKE' || !spot) return `${Math.round(k)}`;
  const lm = Math.log(k / spot) * 100;   // log-moneyness, in %
  return `${lm >= 0 ? '+' : ''}${lm.toFixed(1)}%`;
};

const xAt = (i: number, nx: number) => (i / (nx - 1) - 0.5) * W;
const zAt = (j: number, ny: number) => (j / (ny - 1) - 0.5) * D;

function rgbStr(s: string): [number, number, number] {
  const m = s.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return [1, 1, 1];
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
}

export interface SurfaceHover { i: number; j: number; px: number; py: number; }

// ─────────────────────────────────────────────────────────────────────────────

function SurfaceMesh({ surf, lo, hi, wireframe, onHover, onPick }: {
  surf: Surface | undefined; lo: number; hi: number; wireframe: boolean;
  onHover: (h: SurfaceHover | null) => void;
  onPick: (strikeIdx: number, expiryIdx: number) => void;
}) {
  const nx = surf?.strikes.length ?? 41;
  const ny = surf?.expiries.length ?? 7;

  // Dense mesh: strikes are already dense (41), expiry rows are sparse — give
  // the DTE axis much finer subdivision with curvature-preserving interpolation.
  const SUB_X = 3, SUB_Y = 8;
  const segX = (nx - 1) * SUB_X;
  const segY = (ny - 1) * SUB_Y;

  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, segX, segY);
    const colors = new Float32Array(g.attributes.position.count * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [segX, segY]);

  const targetH = useRef<Float32Array>(new Float32Array((segX + 1) * (segY + 1)));

  // Re-sample the IV grid onto the dense mesh whenever data updates. Heights
  // are DATA ONLY — no decorative noise. Strikes interpolate linearly (dense
  // observations); the sparse expiry axis uses Catmull-Rom, which passes
  // EXACTLY through every observed row while preserving curvature between
  // them — smoothing only between data, never over it.
  useMemo(() => {
    if (!surf) return;
    const gw = segX + 1, gh = segY + 1;
    const arr = new Float32Array(gw * gh);
    const col = new Float64Array(ny);
    for (let ii = 0; ii < gw; ii++) {
      const fx = (ii / (gw - 1)) * (nx - 1);
      const i0 = Math.floor(fx);
      const i1 = Math.min(i0 + 1, nx - 1);
      const tx = fx - i0;
      for (let j = 0; j < ny; j++) {
        col[j] = (surf.iv[j]?.[i0] ?? lo) * (1 - tx) + (surf.iv[j]?.[i1] ?? lo) * tx;
      }
      for (let jj = 0; jj < gh; jj++) {
        const fy = (jj / (gh - 1)) * (ny - 1);
        const j1 = Math.min(Math.max(0, ny - 2), Math.floor(fy));
        const t = fy - j1;
        const p0 = col[Math.max(0, j1 - 1)], p1 = col[j1];
        const p2 = col[Math.min(ny - 1, j1 + 1)], p3 = col[Math.min(ny - 1, j1 + 2)];
        const iv = ny < 2 ? p1 : 0.5 * ((2 * p1) + (-p0 + p2) * t
          + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
          + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
        arr[jj * gw + ii] = Math.max(0, Math.min(1.03, (iv - lo) / (hi - lo || 1))) * HMAX;
      }
    }
    targetH.current = arr;
  }, [surf, lo, hi, nx, ny, segX, segY]);

  // Smooth morph toward the latest data (no jumps on live updates).
  useFrame(() => {
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const col = geom.attributes.color as THREE.BufferAttribute;
    const t = targetH.current;
    let changed = false;
    for (let k = 0; k < pos.count; k++) {
      const cur = pos.getZ(k);
      const tgt = t[k] ?? 0;
      const next = cur + (tgt - cur) * 0.17;   // ≈250ms to converge at 60fps
      pos.setZ(k, next);
      const tt = Math.max(0, Math.min(1, next / HMAX));
      const [r, g, b] = rgbStr(sampleScale(IV_STOPS, tt));
      col.setXYZ(k, r, g, b);
      if (Math.abs(tgt - cur) > 1e-4) changed = true;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    if (changed) geom.computeVertexNormals();
  });

  const last = useRef<{ i: number; j: number }>({ i: -1, j: -1 });
  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (!e.uv) return;
    const i = Math.max(0, Math.min(nx - 1, Math.round(e.uv.x * (nx - 1))));
    const j = Math.max(0, Math.min(ny - 1, Math.round((1 - e.uv.y) * (ny - 1))));
    if (i === last.current.i && j === last.current.j) return;
    last.current = { i, j };
    onHover({ i, j, px: e.nativeEvent.offsetX, py: e.nativeEvent.offsetY });
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!e.uv) return;
    e.stopPropagation();
    const i = Math.max(0, Math.min(nx - 1, Math.round(e.uv.x * (nx - 1))));       // strike
    const j = Math.max(0, Math.min(ny - 1, Math.round((1 - e.uv.y) * (ny - 1)))); // expiry
    onPick(i, j);
  };

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geom} castShadow receiveShadow
        onPointerMove={handleMove} onPointerOut={() => { last.current = { i: -1, j: -1 }; onHover(null); }}
        onClick={handleClick}>
        {/* matte, readable shading — no gloss */}
        <meshStandardMaterial vertexColors metalness={0.04} roughness={0.68}
          transparent opacity={wireframe ? 0.05 : 0.97} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geom}>
        <meshBasicMaterial vertexColors={wireframe} color="#ffffff" wireframe transparent
          opacity={wireframe ? 0.85 : 0.09} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── offline-safe billboarded text (canvas sprite — no font fetches) ──
function TextSprite({ text, position, color = '#8b919c', size = 0.42, opacity = 1 }: {
  text: string; position: [number, number, number]; color?: string; size?: number; opacity?: number;
}) {
  const { texture, aspect } = useMemo(() => {
    const c = document.createElement('canvas');
    const font = `700 44px ui-monospace, SFMono-Regular, Menlo, monospace`;
    let ctx = c.getContext('2d')!;
    ctx.font = font;
    const wpx = Math.ceil(ctx.measureText(text).width) + 14;
    c.width = wpx; c.height = 58;
    ctx = c.getContext('2d')!;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 7, 30);
    const tx = new THREE.CanvasTexture(c);
    tx.anisotropy = 4;
    return { texture: tx, aspect: wpx / 58 };
  }, [text, color]);
  return (
    <sprite position={position} scale={[size * aspect, size, 1]}>
      <spriteMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </sprite>
  );
}

// ── institutional axes: readable ticks + titles, strike or log-moneyness ──
const Axes = memo(function Axes({ surf, lo, hi, spot, xMode }: {
  surf: Surface; lo: number; hi: number; spot: number; xMode: XAxisMode;
}) {
  const nx = surf.strikes.length, ny = surf.expiries.length;
  const strikeIdx = [0, Math.round((nx - 1) / 4), Math.round((nx - 1) / 2), Math.round(3 * (nx - 1) / 4), nx - 1];
  const expIdx = ny <= 8 ? surf.expiries.map((_, j) => j) : [0, Math.round((ny - 1) / 2), ny - 1];
  const ivTicks = [0.25, 0.5, 0.75, 1].map((t) => ({ t, v: lo + (hi - lo) * t }));

  return (
    <group>
      {/* strike / log-moneyness ticks — near edge */}
      {strikeIdx.map((i) => (
        <TextSprite key={`s${i}-${xMode}`} text={xTickLabel(surf.strikes[i], spot, xMode)}
          position={[xAt(i, nx), 0.06, D / 2 + 0.62]} size={0.38} color="#9aa4b1" />
      ))}
      <TextSprite text={xMode === 'STRIKE' ? 'STRIKE' : 'LOG MONEYNESS'}
        position={[0, 0.06, D / 2 + 1.28]} color="#5b616b" size={0.34} />

      {/* DTE ticks — right edge */}
      {expIdx.map((j) => (
        <TextSprite key={`e${j}`} text={`${Math.round(surf.expiries[j])}d`}
          position={[W / 2 + 0.6, 0.06, zAt(j, ny)]} size={0.38} color="#9aa4b1" />
      ))}
      <TextSprite text="DTE" position={[W / 2 + 1.35, 0.06, 0]} color="#5b616b" size={0.34} />

      {/* IV axis pole — front-left corner */}
      <Line points={[[-W / 2, 0, D / 2], [-W / 2, HMAX + 0.15, D / 2]]} color="#3a3f47" lineWidth={1} />
      {ivTicks.map(({ t, v }) => (
        <TextSprite key={t} text={v.toFixed(1)} position={[-W / 2 - 0.55, t * HMAX, D / 2]} size={0.36} color="#9aa4b1" />
      ))}
      <TextSprite text="IV %" position={[-W / 2 - 0.55, HMAX + 0.5, D / 2]} color="#5b616b" size={0.34} />
    </group>
  );
});

// ── subtle market-feature overlays: ATM ridge, spot plane, IV extremes ──
const Overlays = memo(function Overlays({ surf, lo, hi, spot }: { surf: Surface; lo: number; hi: number; spot: number }) {
  const nx = surf.strikes.length, ny = surf.expiries.length;
  const yOf = (iv: number) => Math.max(0, Math.min(1.03, (iv - lo) / (hi - lo || 1))) * HMAX;

  const { atmI, ridge, hiCell, loCell, spotX } = useMemo(() => {
    let atmI = 0;
    for (let i = 1; i < nx; i++) if (Math.abs(surf.strikes[i] - spot) < Math.abs(surf.strikes[atmI] - spot)) atmI = i;
    const ridge: [number, number, number][] = surf.expiries.map((_, j) =>
      [xAt(atmI, nx), yOf(surf.iv[j][atmI]) + 0.03, zAt(j, ny)]);
    let hiCell = { i: 0, j: 0, v: -Infinity }, loCell = { i: 0, j: 0, v: Infinity };
    surf.iv.forEach((row, j) => row.forEach((v, i) => {
      if (v > hiCell.v) hiCell = { i, j, v };
      if (v < loCell.v) loCell = { i, j, v };
    }));
    const frac = (spot - surf.strikes[0]) / (surf.strikes[nx - 1] - surf.strikes[0] || 1);
    return { atmI, ridge, hiCell, loCell, spotX: (Math.max(0, Math.min(1, frac)) - 0.5) * W };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surf, lo, hi, spot]);

  return (
    <group>
      {/* ATM ridge across maturities — always visible (never occluded by hills) */}
      <Line points={ridge} color="#e8d9ae" transparent opacity={0.38} lineWidth={1.6}
        dashed dashSize={0.18} gapSize={0.12} depthTest={false} renderOrder={2} />
      <TextSprite text="ATM" position={[xAt(atmI, nx), yOf(surf.iv[0][atmI]) + 0.42, zAt(0, ny)]} color="#c9ced6" size={0.32} opacity={0.85} />

      {/* current spot plane (vertical, very subtle) */}
      <mesh position={[spotX, HMAX / 2, 0]}>
        <planeGeometry args={[D, HMAX]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.035} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* IV extremes — small ring markers at the cells (their VALUES are the
          legend's dynamic hi/lo bounds, so no floating text to collide with
          the axis labels from any camera angle) */}
      <mesh position={[xAt(hiCell.i, nx), yOf(hiCell.v) + 0.06, zAt(hiCell.j, ny)]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.028, 8, 24]} />
        <meshBasicMaterial color="#ff7000" transparent opacity={0.9} depthTest={false} />
      </mesh>
      <mesh position={[xAt(loCell.i, nx), yOf(loCell.v) + 0.06, zAt(loCell.j, ny)]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.028, 8, 24]} />
        <meshBasicMaterial color="#5aa7ff" transparent opacity={0.9} depthTest={false} />
      </mesh>
    </group>
  );
});

// glowing crosshair marker + guide lines to the three axes
function HoverGuides({ surf, lo, hi, hover }: { surf: Surface; lo: number; hi: number; hover: SurfaceHover }) {
  const nx = surf.strikes.length, ny = surf.expiries.length;
  const iv = surf.iv[hover.j]?.[hover.i];
  if (iv == null) return null;
  const x = xAt(hover.i, nx), z = zAt(hover.j, ny);
  const y = Math.max(0, Math.min(1.03, (iv - lo) / (hi - lo || 1))) * HMAX;
  const c = '#a78bfa';
  return (
    <group>
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshBasicMaterial color={c} />
      </mesh>
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[0.17, 16, 16]} />
        <meshBasicMaterial color={c} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <Line points={[[x, y, z], [x, 0, z]]} color={c} transparent opacity={0.4} lineWidth={1} />
      <Line points={[[x, 0, z], [x, 0, D / 2]]} color={c} transparent opacity={0.3} lineWidth={1} />
      <Line points={[[x, 0, z], [W / 2, 0, z]]} color={c} transparent opacity={0.3} lineWidth={1} />
      <Line points={[[x, y, z], [-W / 2, y, D / 2]]} color={c} transparent opacity={0.18} lineWidth={1} />
    </group>
  );
}

// selected expiry slice (gold) + selected strike across maturities (blue)
function SelectionSlices({ surf, lo, hi }: { surf: Surface; lo: number; hi: number }) {
  const { expiryIdx, strikeIdx } = useVolSelection();
  const nx = surf.strikes.length, ny = surf.expiries.length;
  const yOf = (iv: number) => Math.max(0, Math.min(1.03, (iv - lo) / (hi - lo || 1))) * HMAX + 0.035;
  if (expiryIdx == null || strikeIdx == null) return null;
  if (!surf.iv[expiryIdx] || surf.iv[0]?.[strikeIdx] == null) return null;
  const expiryPts: [number, number, number][] = surf.strikes.map((_, i) =>
    [xAt(i, nx), yOf(surf.iv[expiryIdx][i]), zAt(expiryIdx, ny)]);
  const strikePts: [number, number, number][] = surf.expiries.map((_, j) =>
    [xAt(strikeIdx, nx), yOf(surf.iv[j][strikeIdx]), zAt(j, ny)]);
  return (
    <group>
      <Line points={expiryPts} color="#a78bfa" lineWidth={2.2} transparent opacity={0.95} />
      <Line points={strikePts} color="#5aa7ff" lineWidth={2.2} transparent opacity={0.95} />
    </group>
  );
}

function Lights() {
  // Readability lighting: soft ambient base, one gentle key for shape, a cool
  // rim from behind for depth separation. No hot specular highlights.
  return (
    <>
      <hemisphereLight args={['#cdd6e4', '#0a0c10', 0.55]} />
      <directionalLight position={[6, 11, 4]} intensity={1.05} color="#ffffff" />
      <directionalLight position={[-8, 4, -7]} intensity={0.55} color="#7e93b8" />
      <directionalLight position={[0, 2.5, -11]} intensity={0.35} color="#9db4d8" />
    </>
  );
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <planeGeometry args={[W * 2.4, D * 2.6]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.85} />
      </mesh>
      <gridHelper args={[Math.max(W, D) * 1.5, 14, '#20242b', '#171a20']} position={[0, -0.06, 0]} />
    </>
  );
}

// Smoothly fly the camera to institutional viewpoints (no manual rotating).
function CameraFly({ preset, nonce }: { preset: CameraPreset; nonce: number }) {
  const { camera, controls } = useThree() as any;
  const frames = useRef(0);
  const lastNonce = useRef(-1);
  useFrame(() => {
    if (nonce !== lastNonce.current) { lastNonce.current = nonce; frames.current = 70; }
    if (frames.current <= 0) return;
    frames.current--;
    const goal = PRESET_POS[preset];
    camera.position.lerp(new THREE.Vector3(...goal), 0.09);
    if (controls) { controls.target.lerp(new THREE.Vector3(0, 0.6, 0), 0.09); controls.update(); }
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export function VolSurface({ wireframe = false, preset = 'PERSPECTIVE' as CameraPreset, presetNonce = 0,
  surfOverride = null, xMode = 'STRIKE' as XAxisMode }: {
  wireframe?: boolean; preset?: CameraPreset; presetNonce?: number;
  surfOverride?: Surface | null;   // Model surface when the hero is in MODEL mode
  xMode?: XAxisMode;
}) {
  const [hover, setHover] = useState<SurfaceHover | null>(null);
  const { snap } = useVolSnap();               // replay-aware surface
  const { moments } = useReplay();
  const { select } = useVolSelection();
  const surf = surfOverride ?? snap?.surface;
  const spot = snap?.spot ?? 0;
  // History grids are aligned to the PRIMARY surface — suppress day-change
  // readouts when rendering the Model fit over a live-chain primary.
  const historyOk = surf === snap?.surface;
  const ydayGrid = historyOk ? snap?.volHistory?.surfaceYesterday ?? null : null;
  const avg5Front = historyOk ? snap?.volHistory?.smileAvg5 ?? null : null;
  const { lo, hi } = useMemo(() => gridRange(surf?.iv ?? []), [surf]);

  // ── tooltip analytics for the hovered point ──
  const tip = useMemo(() => {
    if (!hover || !surf) return null;
    const iv = surf.iv[hover.j]?.[hover.i];
    if (iv == null) return null;
    const strike = surf.strikes[hover.i];
    const dte = surf.expiries[hover.j];
    let atmI = 0;
    for (let i = 1; i < surf.strikes.length; i++) if (Math.abs(surf.strikes[i] - spot) < Math.abs(surf.strikes[atmI] - spot)) atmI = i;
    const dYday = ydayGrid?.[hover.j]?.[hover.i] != null ? iv - ydayGrid[hover.j][hover.i] : null;
    // session change vs the earliest replay sample (matched by nearest strike/expiry)
    let dSession: number | null = null;
    const first = moments[0]?.sample.surface;
    if (first?.iv?.length) {
      let fi = 0, fj = 0;
      for (let i = 1; i < first.strikes.length; i++) if (Math.abs(first.strikes[i] - strike) < Math.abs(first.strikes[fi] - strike)) fi = i;
      for (let j = 1; j < first.expiries.length; j++) if (Math.abs(first.expiries[j] - dte) < Math.abs(first.expiries[fj] - dte)) fj = j;
      const v0 = first.iv[fj]?.[fi];
      if (v0 != null) dSession = iv - v0;
    }
    const kind = strike < spot ? 'P' as const : 'C' as const;
    const delta = spot > 0 ? bs(spot, strike, Math.max(dte, 0.5) / 365, iv / 100, 0.066, kind).delta : null;
    // Richness: IV vs the 5-day average — observed for the front expiry only.
    const d5 = hover.j === 0 && avg5Front?.[hover.i] != null ? iv - avg5Front[hover.i] : null;
    const richness = d5 == null ? null : d5 > 0.35 ? 'Rich' : d5 < -0.35 ? 'Cheap' : 'Fair';
    return {
      strike, dte, iv, dYday, dSession, d5, richness,
      skew: iv - surf.iv[hover.j][atmI],
      moneyness: spot > 0 ? (strike / spot - 1) * 100 : null,
      delta, kind,
    };
  }, [hover, surf, spot, ydayGrid, avg5Front, moments]);

  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: PRESET_POS.PERSPECTIVE, fov: 42 }} shadows>
        <fog attach="fog" args={['#000000', 28, 52]} />
        <Lights />
        <Floor />
        <SurfaceMesh surf={surf} lo={lo} hi={hi} wireframe={wireframe} onHover={setHover}
          onPick={(i, j) => select(j, i)} />
        {surf && <Axes surf={surf} lo={lo} hi={hi} spot={spot} xMode={xMode} />}
        {surf && spot > 0 && <Overlays surf={surf} lo={lo} hi={hi} spot={spot} />}
        {surf && <SelectionSlices surf={surf} lo={lo} hi={hi} />}
        {surf && hover && <HoverGuides surf={surf} lo={lo} hi={hi} hover={hover} />}
        <CameraFly preset={preset} nonce={presetNonce} />
        <OrbitControls makeDefault enablePan enableZoom minDistance={5} maxDistance={24}
          maxPolarAngle={Math.PI / 2.05} target={[0, 0.6, 0]} enableDamping dampingFactor={0.08} />
      </Canvas>

      {/* crosshair tooltip — the full institutional read at the point */}
      {hover && tip && (
        <div className="pointer-events-none absolute z-20 min-w-[128px] rounded-[5px] border border-[color:var(--line)] bg-black/88 px-2 py-1.5"
          style={{ left: Math.min(hover.px + 16, window.innerWidth * 0.6), top: Math.max(2, hover.py - 92) }}>
          <div className="mono text-[9px] font-bold text-[color:var(--text)]">
            {tip.strike.toLocaleString('en-IN')} · {Math.round(tip.dte)}d
            {tip.moneyness != null && <span className="ml-1 text-[color:var(--faint)]">({tip.moneyness >= 0 ? '+' : ''}{tip.moneyness.toFixed(1)}%)</span>}
          </div>
          <TipRow label="IV" value={`${tip.iv.toFixed(2)}%`} color="var(--gold)" />
          {tip.delta != null && <TipRow label={`Δ (${tip.kind === 'P' ? 'put' : 'call'})`} value={tip.delta.toFixed(2)} color="var(--text)" />}
          <TipRow label="Skew vs ATM" value={`${tip.skew >= 0 ? '+' : ''}${tip.skew.toFixed(2)}`}
            color={Math.abs(tip.skew) < 0.3 ? 'var(--dim)' : tip.skew > 0 ? 'var(--neg)' : 'var(--info)'} />
          <TipRow label="Δ 1d" value={tip.dYday == null ? 'no history' : `${tip.dYday >= 0 ? '+' : ''}${tip.dYday.toFixed(2)}`}
            color={tip.dYday == null ? 'var(--faint)' : tip.dYday >= 0 ? 'var(--neg)' : 'var(--pos)'} />
          {tip.d5 != null && (
            <TipRow label="Δ 5d avg" value={`${tip.d5 >= 0 ? '+' : ''}${tip.d5.toFixed(2)}`}
              color={tip.d5 >= 0 ? 'var(--neg)' : 'var(--pos)'} />
          )}
          {tip.richness && (
            <TipRow label="Richness" value={tip.richness}
              color={tip.richness === 'Rich' ? 'var(--neg)' : tip.richness === 'Cheap' ? 'var(--info)' : 'var(--dim)'} />
          )}
          {tip.dSession != null && (
            <TipRow label="Δ session" value={`${tip.dSession >= 0 ? '+' : ''}${tip.dSession.toFixed(2)}`}
              color={tip.dSession >= 0 ? 'var(--neg)' : 'var(--pos)'} />
          )}
          <div className="mt-0.5 text-[6.5px] tracking-wide text-[color:var(--faint)]">CLICK · SYNC SMILE + TERM TO THIS POINT</div>
        </div>
      )}
    </div>
  );
}

function TipRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[8px]">
      <span className="text-[color:var(--dim)]">{label}</span>
      <span className="mono font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

