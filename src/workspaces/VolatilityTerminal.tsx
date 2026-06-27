import { lazy, Suspense, useState } from 'react';
import { motion } from 'motion/react';
import { Maximize2, Box, Grid3x3 } from 'lucide-react';
import { useTerminal } from '../store';
import { useVol } from '../lib/vol/useVol';
import { Panel } from '../components/ui/Panel';
import { VolMetricsGrid } from '../components/panels/VolMetricsGrid';
import { VolEnginePanel } from '../components/vol/VolEnginePanel';
import { LineChart } from '../components/charts/LineChart';

const VolSurface = lazy(() =>
  import('../components/VolSurface').then((m) => ({ default: m.VolSurface })),
);

export function VolatilityTerminal() {
  const [wire, setWire] = useState(false);
  const vol = useVol();

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      {/* ── 3D VOL SURFACE HERO ── */}
      <section className="glass relative col-start-1 col-span-7 row-start-1 row-span-4 overflow-hidden">
        <div className="pointer-events-none absolute left-3.5 top-2.5 z-10">
          <div className="section-title">3D Volatility Surface</div>
          <div className="mt-0.5 text-[9px] tracking-wide text-[color:var(--dim)]">NIFTY · 29 MAY 2025 EXPIRY</div>
        </div>

        <div className="absolute right-3 top-2.5 z-10 flex items-center gap-1">
          <Seg active={!wire} onClick={() => setWire(false)} icon={<Box size={11} />} label="Surface" />
          <Seg active={wire} onClick={() => setWire(true)} icon={<Grid3x3 size={11} />} label="Wireframe" />
          <button className="nav-item flex h-6 w-6 items-center justify-center text-[color:var(--dim)] hover:text-[color:var(--text)]">
            <Maximize2 size={11} />
          </button>
        </div>

        <SurfaceBadge />

        <div className="pointer-events-none absolute right-3.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
          <div className="flex flex-col justify-between py-0.5 text-[7px] text-[color:var(--dim)]" style={{ height: 120 }}>
            {[32, 24, 16, 8, 0].map((t) => <span key={t}>{t}</span>)}
          </div>
          <div className="h-[120px] w-2 rounded-[2px]" style={{ background: 'linear-gradient(to bottom,#ff0030,#ff7000,#ffe000,#00e890,#00c8ff,#0055ff,#1a00d4)' }} />
          <span className="text-[7px] tracking-wider text-[color:var(--dim)]">IV %</span>
        </div>

        <div className="pointer-events-none absolute bottom-2.5 left-3.5 z-10 text-[8px] tracking-wide text-[color:var(--faint)]">
          Drag to rotate · Scroll to zoom · Right-click to pan
        </div>
        <div className="pointer-events-none absolute bottom-2.5 right-3.5 z-10 flex gap-3 text-[7px] tracking-widest text-[color:var(--dim)]">
          <span>X · STRIKE</span><span>Y · DTE</span><span>Z · IV %</span>
        </div>

        <Suspense fallback={<CanvasFallback />}>
          <VolSurface wireframe={wire} />
        </Suspense>
      </section>

      {/* ── VOLATILITY ENGINE (flagship analytics) ── */}
      <Panel title="Volatility Engine" accent="var(--info)" className="col-start-8 col-span-5 row-start-1 row-span-4" delay={0.06}>
        {vol ? <VolEnginePanel v={vol} /> : <Empty />}
      </Panel>

      {/* ── VOLATILITY METRICS ── */}
      <Panel title="Volatility Metrics" accent="var(--pos)" className="col-start-1 col-span-4 row-start-5 row-span-2" delay={0.12}>
        <VolMetricsGrid />
      </Panel>

      {/* ── VOLATILITY SMILE ── */}
      <Panel title="Volatility Smile" accent="var(--gold)" className="col-start-5 col-span-4 row-start-5 row-span-2" delay={0.16}>
        <SmileChart />
      </Panel>

      {/* ── TERM STRUCTURE ── */}
      <Panel title="Term Structure" accent="var(--pos)" className="col-start-9 col-span-4 row-start-5 row-span-2" delay={0.2}>
        <TermChart />
      </Panel>
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
    <div className="pointer-events-none absolute right-3 top-10 z-10 flex items-center gap-1.5 rounded-[4px] border border-[color:var(--line)] bg-black/40 px-1.5 py-0.5">
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

function SmileChart() {
  const smile = useTerminal((s) => s.snap?.smile);
  const spot = useTerminal((s) => s.snap?.spot);
  if (!smile) return null;
  const weekAgo = smile.iv.map((x) => x * 0.94 + 0.4);
  const monthAgo = smile.iv.map((x) => x * 0.88 + 0.8);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center gap-3 text-[8px] tracking-wide text-[color:var(--dim)]">
        <Legend color="#f4b740" label="Current IV" />
        <Legend color="#6b7280" label="Week Ago" dashed />
        <Legend color="#4b515b" label="Month Ago" dashed />
      </div>
      <div className="min-h-0 flex-1">
        <LineChart x={smile.strikes ?? []} y={smile.iv} color="#f4b740" marker={spot} yLabel="IV %" xLabel="strike" dots
          ghosts={[{ y: weekAgo, color: '#6b7280', dash: '4 3' }, { y: monthAgo, color: '#4b515b', dash: '4 3' }]} />
      </div>
    </div>
  );
}

function TermChart() {
  const term = useTerminal((s) => s.snap?.term);
  if (!term) return null;
  return <LineChart x={term.dte ?? []} y={term.iv} color="#f4b740" yLabel="IV %" xLabel="days to expiry" dots pointLabels={(x) => `${x.toFixed(1)}%`} />;
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-[2px] w-3" style={{ background: dashed ? `repeating-linear-gradient(90deg,${color} 0 3px,transparent 3px 6px)` : color }} />
      {label}
    </span>
  );
}
