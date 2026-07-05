import { lazy, Suspense, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Box, Grid3x3, LayoutGrid } from 'lucide-react';
import { useTerminal } from '../store';
import { VolReplayProvider, useVolSnap, useVolState } from '../lib/vol/replay';
import { VolSelectionProvider, useVolSelection } from '../lib/vol/selection';
import { gridRange } from '../lib/vol/scale';
import { IV_STOPS } from '../theme';
import { Panel } from '../components/ui/Panel';
import { VolMetricsGrid } from '../components/panels/VolMetricsGrid';
import { VolEnginePanel } from '../components/vol/VolEnginePanel';
import { SmileChart } from '../components/vol/SmileChart';
import { TermStructureChart } from '../components/vol/TermStructureChart';
import { IVHeatmap } from '../components/vol/IVHeatmap';
import { VolCycleReplay } from '../components/vol/VolCycleReplay';
import type { CameraPreset, XAxisMode } from '../components/VolSurface';

const VolSurface = lazy(() =>
  import('../components/VolSurface').then((m) => ({ default: m.VolSurface })),
);

type SurfaceView = 'SURFACE' | 'WIREFRAME' | 'HEATMAP';
type SurfMode = 'LIVE' | 'MODEL';
const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'PERSPECTIVE', label: 'Persp' },
  { id: 'TOP', label: 'Top' },
  { id: 'SMILE', label: 'Smile' },
  { id: 'TERM', label: 'Term' },
  { id: 'SKEW', label: 'Skew' },
];

export function VolatilityTerminal() {
  return (
    <VolReplayProvider>
      <VolSelectionProvider>
        <Inner />
      </VolSelectionProvider>
    </VolReplayProvider>
  );
}

function Inner() {
  const [view, setView] = useState<SurfaceView>('SURFACE');
  const [preset, setPreset] = useState<CameraPreset>('PERSPECTIVE');
  const [presetNonce, setPresetNonce] = useState(0);
  const [surfMode, setSurfMode] = useState<SurfMode>('LIVE');
  const [xMode, setXMode] = useState<XAxisMode>('STRIKE');
  const vol = useVolState();                 // replay-aware engine state
  const { snap, replayingAt } = useVolSnap();
  const sel = useVolSelection();

  const surf = snap?.surface;
  // LIVE vs MODEL: the toggle only exists when the primary surface is the real
  // chain AND a fitted model is served; replay always shows the recorded surface.
  const canToggleMode = !replayingAt && !!surf?.live && !!snap?.surfaceModel;
  const effMode: SurfMode = canToggleMode ? surfMode : surf?.live ? 'LIVE' : 'MODEL';
  const surfOverride = canToggleMode && surfMode === 'MODEL' ? snap!.surfaceModel! : null;

  const selChip = sel.expiryIdx != null && sel.strikeIdx != null && surf
    ? `${Math.round(surf.expiries[sel.expiryIdx] ?? 0)}d · K ${Math.round(surf.strikes[sel.strikeIdx] ?? 0)}`
    : null;

  const fly = (p: CameraPreset) => { setPreset(p); setPresetNonce((n) => n + 1); };

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      {/* ── IV SURFACE HERO ── */}
      <section className="glass relative col-start-1 col-span-7 row-start-1 row-span-4 overflow-hidden">
        <div className="pointer-events-none absolute left-3.5 top-2.5 z-10">
          <div className="section-title">{view === 'HEATMAP' ? 'IV Heatmap' : 'Implied Volatility Surface'}</div>
          <div className="mt-0.5 text-[9px] tracking-wide text-[color:var(--dim)]">NIFTY · STRIKE × DTE × IV%</div>
        </div>

        <div className="absolute right-3 top-2.5 z-10 flex items-center gap-1">
          <Seg active={view === 'SURFACE'} onClick={() => setView('SURFACE')} icon={<Box size={11} />} label="Surface" />
          <Seg active={view === 'WIREFRAME'} onClick={() => setView('WIREFRAME')} icon={<Grid3x3 size={11} />} label="Wireframe" />
          <Seg active={view === 'HEATMAP'} onClick={() => setView('HEATMAP')} icon={<LayoutGrid size={11} />} label="Heatmap" />
        </div>

        {/* camera presets + data/axis modes — instant institutional viewpoints */}
        <div className="absolute right-3 top-[38px] z-10 flex items-center gap-1">
          {view !== 'HEATMAP' && PRESETS.map((p) => (
            <button key={p.id} onClick={() => fly(p.id)}
              className="rounded-[4px] border px-1.5 py-0.5 text-[8px] font-semibold tracking-wide transition"
              style={{ borderColor: preset === p.id ? 'rgba(244,183,64,0.35)' : 'var(--line)', color: preset === p.id ? 'var(--gold)' : 'var(--dim)' }}>
              {p.label}
            </button>
          ))}
          <span className="mx-0.5 h-3 w-px bg-[color:var(--line)]" />
          {canToggleMode && (['LIVE', 'MODEL'] as SurfMode[]).map((m) => (
            <button key={m} onClick={() => setSurfMode(m)}
              title={m === 'LIVE' ? 'Raw chain surface — real market irregularities' : 'Smooth parametric fit'}
              className="rounded-[4px] border px-1.5 py-0.5 text-[8px] font-semibold tracking-wide transition"
              style={{ borderColor: effMode === m ? 'rgba(90,167,255,0.4)' : 'var(--line)', color: effMode === m ? 'var(--info)' : 'var(--dim)' }}>
              {m}
            </button>
          ))}
          <button onClick={() => setXMode(xMode === 'STRIKE' ? 'MONEYNESS' : 'STRIKE')}
            title="Toggle strike / log-moneyness axis"
            className="rounded-[4px] border border-[color:var(--line)] px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-[color:var(--dim)] transition hover:text-[color:var(--text)]">
            {xMode === 'STRIKE' ? 'K' : 'ln(K/S)'}
          </button>
        </div>

        <div className="absolute left-3.5 top-10 z-10 flex items-center gap-1.5">
          <SurfaceBadge />
          {replayingAt && (
            <span className="pointer-events-none flex items-center gap-1 rounded-[4px] border border-[color:var(--gold)] bg-black/60 px-1.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
              <span className="text-[7px] font-bold tracking-widest text-[color:var(--gold)]">REPLAY {replayingAt}</span>
            </span>
          )}
          {selChip && (
            <button onClick={sel.clear} title="Clear slice selection"
              className="flex items-center gap-1 rounded-[4px] border border-[color:var(--info)] bg-black/60 px-1.5 py-0.5">
              <span className="text-[7px] font-bold tracking-widest text-[color:var(--info)]">SLICE {selChip}</span>
              <span className="text-[8px] leading-none text-[color:var(--dim)]">×</span>
            </button>
          )}
        </div>

        <IVLegend />

        {view === 'HEATMAP'
          ? <IVHeatmap surfOverride={surfOverride} xMode={xMode} />
          : (
            <Suspense fallback={<CanvasFallback />}>
              <VolSurface wireframe={view === 'WIREFRAME'} preset={preset} presetNonce={presetNonce}
                surfOverride={surfOverride} xMode={xMode} />
            </Suspense>
          )}
      </section>

      {/* ── VOLATILITY ENGINE ── */}
      <Panel title="Volatility Engine" accent="var(--info)" className="col-start-8 col-span-5 row-start-1 row-span-4" delay={0.06}>
        {vol ? <VolEnginePanel v={vol} /> : <Empty />}
      </Panel>

      {/* ── BOTTOM ROW ── */}
      <Panel title="Volatility Metrics" accent="var(--pos)" className="col-start-1 col-span-3 row-start-5 row-span-2" delay={0.12}>
        <VolMetricsGrid />
      </Panel>

      <Panel title="Volatility Smile" accent="var(--gold)" className="col-start-4 col-span-3 row-start-5 row-span-2" delay={0.16}>
        <SmileChart />
      </Panel>

      <Panel title="Term Structure" accent="var(--pos)" className="col-start-7 col-span-3 row-start-5 row-span-2" delay={0.2}>
        <TermStructureChart />
      </Panel>

      <Panel title="Volatility Cycle · Session Replay" accent="var(--violet)" className="col-start-10 col-span-3 row-start-5 row-span-2" delay={0.24}>
        <VolCycleReplay />
      </Panel>
    </div>
  );
}

// Dynamic IV legend — bounds follow the live surface (the ramp is relative).
function IVLegend() {
  const { snap } = useVolSnap();
  const iv = snap?.surface?.iv;
  const { lo, hi } = useMemo(() => gridRange(iv ?? []), [iv]);
  const gradient = useMemo(() => {
    const stops = [...IV_STOPS].reverse().map(([t, c]) => `${c} ${(100 * (1 - t)).toFixed(0)}%`);
    return `linear-gradient(to bottom, ${stops.join(',')})`;
  }, []);
  if (!iv) return null;
  return (
    <div className="pointer-events-none absolute right-3.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
      <div className="mono flex flex-col justify-between py-0.5 text-right text-[7px] text-[color:var(--dim)]" style={{ height: 110 }}>
        <span>{hi.toFixed(1)}</span>
        <span>{((lo + hi) / 2).toFixed(1)}</span>
        <span>{lo.toFixed(1)}</span>
      </div>
      <div className="h-[110px] w-2 rounded-[2px]" style={{ background: gradient }} />
      <span className="text-[7px] tracking-wider text-[color:var(--dim)]" style={{ writingMode: 'vertical-rl' }}>IV %</span>
    </div>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Computing volatility state…</div>;
}

function Seg({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 rounded-[6px] border px-1.5 py-1 text-[9px] font-medium transition"
      style={{ borderColor: active ? 'rgba(244,183,64,0.3)' : 'var(--line)', background: active ? 'rgba(244,183,64,0.1)' : 'transparent', color: active ? 'var(--gold)' : 'var(--dim)' }}>
      {icon}{label}
    </button>
  );
}

function SurfaceBadge() {
  const live = useTerminal((s) => s.snap?.surface.live);
  const synthetic = useTerminal((s) => s.snap?.positioning.synthetic);
  const label = live ? 'LIVE NSE CHAIN IV' : synthetic === false ? 'LIVE' : 'PARAMETRIC MODEL';
  return (
    <div className="pointer-events-none flex items-center gap-1.5 rounded-[4px] border border-[color:var(--line)] bg-black/40 px-1.5 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full pulse" style={{ background: live ? 'var(--pos)' : 'var(--gold)' }} />
      <span className="text-[7px] font-semibold tracking-widest text-[color:var(--dim)]">{label}</span>
    </div>
  );
}

function CanvasFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }} className="eyebrow">
        Initialising WebGL surface…
      </motion.div>
    </div>
  );
}
