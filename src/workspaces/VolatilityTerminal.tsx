import { lazy, Suspense, useState } from 'react';
import { motion } from 'motion/react';
import { Box, Grid3x3, LayoutGrid } from 'lucide-react';
import { useTerminal } from '../store';
import { useVol } from '../lib/vol/useVol';
import { Panel } from '../components/ui/Panel';
import { VolMetricsGrid } from '../components/panels/VolMetricsGrid';
import { VolEnginePanel } from '../components/vol/VolEnginePanel';
import { SmileChart } from '../components/vol/SmileChart';
import { TermStructureChart } from '../components/vol/TermStructureChart';
import { IVHeatmap } from '../components/vol/IVHeatmap';
import { RecommendedStrategies } from '../components/vol/RecommendedStrategies';

const VolSurface = lazy(() =>
  import('../components/VolSurface').then((m) => ({ default: m.VolSurface })),
);

type SurfaceView = 'SURFACE' | 'WIREFRAME' | 'HEATMAP';

export function VolatilityTerminal() {
  const [view, setView] = useState<SurfaceView>('SURFACE');
  const vol = useVol();

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      {/* ── IV SURFACE HERO (3D / heatmap) ── */}
      <section className="glass relative col-start-1 col-span-7 row-start-1 row-span-4 overflow-hidden">
        <div className="pointer-events-none absolute left-3.5 top-2.5 z-10">
          <div className="section-title">{view === 'HEATMAP' ? 'IV Heatmap' : '3D Volatility Surface'}</div>
          <div className="mt-0.5 text-[9px] tracking-wide text-[color:var(--dim)]">NIFTY · STRIKE × EXPIRY</div>
        </div>

        <div className="absolute right-3 top-2.5 z-10 flex items-center gap-1">
          <Seg active={view === 'SURFACE'} onClick={() => setView('SURFACE')} icon={<Box size={11} />} label="Surface" />
          <Seg active={view === 'WIREFRAME'} onClick={() => setView('WIREFRAME')} icon={<Grid3x3 size={11} />} label="Wireframe" />
          <Seg active={view === 'HEATMAP'} onClick={() => setView('HEATMAP')} icon={<LayoutGrid size={11} />} label="Heatmap" />
        </div>

        <SurfaceBadge />

        {/* shared IV color legend */}
        <div className="pointer-events-none absolute right-3.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
          <div className="flex flex-col justify-between py-0.5 text-[7px] text-[color:var(--dim)]" style={{ height: 120 }}>
            {[32, 24, 16, 8, 0].map((t) => <span key={t}>{t}</span>)}
          </div>
          <div className="h-[120px] w-2 rounded-[2px]" style={{ background: 'linear-gradient(to bottom,#ff0030,#ff7000,#ffe000,#00e890,#00c8ff,#0055ff,#1a00d4)' }} />
          <span className="text-[7px] tracking-wider text-[color:var(--dim)]">IV %</span>
        </div>

        {view !== 'HEATMAP' && (
          <>
            <div className="pointer-events-none absolute bottom-2.5 left-3.5 z-10 text-[8px] tracking-wide text-[color:var(--faint)]">
              Hover for strike · expiry · IV · 1-day Δ — drag to rotate, scroll to zoom
            </div>
            <div className="pointer-events-none absolute bottom-2.5 right-3.5 z-10 flex gap-3 text-[7px] tracking-widest text-[color:var(--dim)]">
              <span>X · STRIKE</span><span>Y · DTE</span><span>Z · IV %</span>
            </div>
          </>
        )}

        {view === 'HEATMAP'
          ? <IVHeatmap />
          : (
            <Suspense fallback={<CanvasFallback />}>
              <VolSurface wireframe={view === 'WIREFRAME'} />
            </Suspense>
          )}
      </section>

      {/* ── VOLATILITY ENGINE (actionable) ── */}
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

      <Panel title="Recommended Strategies" accent="var(--violet)" className="col-start-10 col-span-3 row-start-5 row-span-2" delay={0.24}>
        {vol ? <RecommendedStrategies v={vol} /> : <Empty />}
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
