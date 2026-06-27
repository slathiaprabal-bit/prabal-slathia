import { lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import { useTerminal } from './store';
import { BackgroundFX } from './components/BackgroundFX';
import { TopBar } from './components/TopBar';
import { ErrorBanner } from './components/ErrorBanner';
import { Sidebar } from './components/Sidebar';
import { Panel } from './components/ui/Panel';
import { RegimePanel } from './components/panels/RegimePanel';
import { VolMetricsPanel } from './components/panels/VolMetricsPanel';
import { AIDecisionPanel } from './components/panels/AIDecisionPanel';
import { MacroPanel } from './components/panels/MacroPanel';
import { LineChart } from './components/charts/LineChart';

// Heavy WebGL canvas — lazy load so first paint is instant.
const VolSurface = lazy(() =>
  import('./components/VolSurface').then((m) => ({ default: m.VolSurface })),
);

export default function App() {
  return (
    <div className="grid-bg flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg0)' }}>
      <BackgroundFX />
      <TopBar />
      <ErrorBanner />

      {/* Body: sidebar + content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content grid */}
        <main className="grid min-h-0 flex-1 grid-cols-12 grid-rows-6 gap-2.5 p-2.5">

          {/* ── LEFT COLUMN ── */}
          <Panel
            title="Market Regime"
            className="col-start-1 col-span-3 row-start-1 row-span-2"
            delay={0.04}
          >
            <RegimePanel />
          </Panel>

          <Panel
            title="Volatility Intelligence"
            className="col-start-1 col-span-3 row-start-3 row-span-4"
            accent="#3fd6f5"
            delay={0.08}
          >
            <VolMetricsPanel />
          </Panel>

          {/* ── CENTER — 3D VOL SURFACE HERO ── */}
          <section className="glass relative col-start-4 col-span-6 row-start-1 row-span-4 overflow-hidden">
            {/* Surface labels */}
            <div className="pointer-events-none absolute left-4 top-3 z-10">
              <div className="eyebrow text-[8px]">Implied Volatility Surface</div>
              <div className="text-base font-extrabold tracking-tight text-white neon-text">
                NIFTY · LIVE 3-D VOL SURFACE
              </div>
            </div>
            <SurfaceBadge />
            {/* Axis labels */}
            <div className="pointer-events-none absolute bottom-3 left-4 z-10 flex gap-5 text-[8px] tracking-widest text-[color:var(--dim)]">
              <span>X · STRIKE</span>
              <span>Y · EXPIRY (DTE)</span>
              <span>Z · IMPLIED VOL %</span>
            </div>
            {/* Rainbow legend */}
            <div className="pointer-events-none absolute right-4 bottom-3 z-10 flex flex-col items-end gap-1">
              <div className="text-[7px] tracking-wider text-[color:var(--dim)] mb-0.5">IV %</div>
              <div
                className="h-24 w-2.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(to bottom, #ff0030, #ff7000, #ffe000, #00e890, #00c8ff, #0055ff, #1a00d4)',
                }}
              />
              <div className="flex flex-col items-end gap-0 text-[7px] text-[color:var(--dim)]">
                <span>HIGH</span>
                <span className="mt-14">LOW</span>
              </div>
            </div>
            <Suspense fallback={<CanvasFallback />}>
              <VolSurface />
            </Suspense>
          </section>

          {/* Bottom center: Smile + Term charts */}
          <Panel
            title="Volatility Smile"
            className="col-start-4 col-span-3 row-start-5 row-span-2"
            accent="#3fd6f5"
            delay={0.22}
          >
            <SmileChart />
          </Panel>
          <Panel
            title="Term Structure"
            className="col-start-7 col-span-3 row-start-5 row-span-2"
            accent="#8b5cf6"
            delay={0.26}
          >
            <TermChart />
          </Panel>

          {/* ── RIGHT COLUMN ── */}
          <Panel
            title="AI Decision Engine"
            className="col-start-10 col-span-3 row-start-1 row-span-4"
            accent="#16f5b0"
            delay={0.12}
          >
            <AIDecisionPanel />
          </Panel>

          <Panel
            title="Macro Intelligence"
            className="col-start-10 col-span-3 row-start-5 row-span-2"
            accent="#c084fc"
            delay={0.18}
          >
            <MacroPanel />
          </Panel>

        </main>
      </div>
    </div>
  );
}

function SurfaceBadge() {
  const live = useTerminal((s) => s.snap?.surface.live);
  const synthetic = useTerminal((s) => s.snap?.positioning.synthetic);
  const label = live ? 'LIVE NSE CHAIN IV' : synthetic === false ? 'LIVE' : 'PARAMETRIC MODEL';
  return (
    <div className="pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#16f5b0]' : 'bg-[#ffb020]'} pulse`} />
      <span className="text-[8px] font-semibold tracking-widest text-[color:var(--dim)]">{label}</span>
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
  return (
    <LineChart
      x={smile.strikes ?? []}
      y={smile.iv}
      color="#3fd6f5"
      marker={spot}
      yLabel="IV %"
      xLabel="strike"
    />
  );
}

function TermChart() {
  const term = useTerminal((s) => s.snap?.term);
  if (!term) return null;
  return (
    <LineChart
      x={term.dte ?? []}
      y={term.iv}
      color="#8b5cf6"
      yLabel="IV %"
      xLabel="days to expiry"
    />
  );
}
