import { lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import { useTerminal } from './store';
import { BackgroundFX } from './components/BackgroundFX';
import { TopBar } from './components/TopBar';
import { ErrorBanner } from './components/ErrorBanner';
import { Panel } from './components/ui/Panel';
import { RegimePanel } from './components/panels/RegimePanel';
import { GreeksPanel } from './components/panels/GreeksPanel';
import { TradeDecisionPanel } from './components/panels/TradeDecisionPanel';
import { RiskPanel } from './components/panels/RiskPanel';
import { OptionChainHeatmap } from './components/panels/OptionChainHeatmap';
import { LineChart } from './components/charts/LineChart';

// The WebGL canvas is heavy — lazy-load so first paint is instant.
const VolSurface = lazy(() =>
  import('./components/VolSurface').then((m) => ({ default: m.VolSurface })),
);

export default function App() {
  return (
    <div className="grid-bg flex h-screen flex-col overflow-hidden">
      <BackgroundFX />
      <TopBar />
      <ErrorBanner />
      <main className="grid min-h-0 flex-1 grid-cols-12 grid-rows-6 gap-3 p-3">
        {/* LEFT COLUMN */}
        <Panel title="Market Regime" className="col-start-1 col-span-3 row-start-1 row-span-2" delay={0.05}>
          <RegimePanel />
        </Panel>
        <Panel title="Position Greeks" className="col-start-1 col-span-3 row-start-3 row-span-2" accent="#c084fc" delay={0.1}>
          <GreeksPanel />
        </Panel>
        <Panel title="AI Decision Engine" className="col-start-1 col-span-3 row-start-5 row-span-2" accent="#16f5b0" delay={0.15}>
          <TradeDecisionPanel />
        </Panel>

        {/* CENTER — SURFACE CENTERPIECE */}
        <section className="glass relative col-start-4 col-span-6 row-start-1 row-span-4 overflow-hidden">
          <div className="pointer-events-none absolute left-4 top-3 z-10">
            <div className="eyebrow">Implied Volatility Surface</div>
            <div className="text-lg font-bold tracking-tight text-white">NIFTY · LIVE 3D VOL SURFACE</div>
          </div>
          <SurfaceBadge />
          <div className="pointer-events-none absolute bottom-3 left-4 z-10 flex gap-4 text-[9px] tracking-widest text-[color:var(--dim)]">
            <span>X · STRIKE</span>
            <span>Y · EXPIRY</span>
            <span>Z · IMPLIED VOL</span>
          </div>
          <Suspense fallback={<CanvasFallback />}>
            <VolSurface />
          </Suspense>
        </section>

        {/* RIGHT COLUMN */}
        <Panel title="Risk Engine · Monte-Carlo" className="col-start-10 col-span-3 row-start-1 row-span-3" accent="#ff2d6e" delay={0.2}>
          <RiskPanel />
        </Panel>
        <Panel title="Option Chain · OI Heatmap" className="col-start-10 col-span-3 row-start-4 row-span-3" accent="#3fd6f5" delay={0.25}>
          <OptionChainHeatmap />
        </Panel>

        {/* BOTTOM ROW — CHARTS (under the surface) */}
        <Panel title="Volatility Smile" className="col-start-4 col-span-3 row-start-5 row-span-2" accent="#3fd6f5" delay={0.3}>
          <SmileChart />
        </Panel>
        <Panel title="Term Structure" className="col-start-7 col-span-3 row-start-5 row-span-2" accent="#8b5cf6" delay={0.35}>
          <TermChart />
        </Panel>
      </main>
    </div>
  );
}

function SurfaceBadge() {
  const live = useTerminal((s) => s.snap?.surface.live);
  const synthetic = useTerminal((s) => s.snap?.positioning.synthetic);
  const label = live ? 'LIVE NSE CHAIN IV' : synthetic === false ? 'LIVE' : 'PARAMETRIC MODEL';
  return (
    <div className="pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#16f5b0]' : 'bg-[#ffb020]'} pulse`} />
      <span className="text-[9px] font-semibold tracking-widest text-[color:var(--dim)]">{label}</span>
    </div>
  );
}

function CanvasFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        className="eyebrow"
      >
        Initialising WebGL surface…
      </motion.div>
    </div>
  );
}

function SmileChart() {
  const smile = useTerminal((s) => s.snap?.smile);
  const spot = useTerminal((s) => s.snap?.spot);
  if (!smile) return null;
  return <LineChart x={smile.strikes ?? []} y={smile.iv} color="#3fd6f5" marker={spot} yLabel="IV %" xLabel="strike" />;
}

function TermChart() {
  const term = useTerminal((s) => s.snap?.term);
  if (!term) return null;
  return <LineChart x={term.dte ?? []} y={term.iv} color="#8b5cf6" yLabel="IV %" xLabel="days to expiry" />;
}
