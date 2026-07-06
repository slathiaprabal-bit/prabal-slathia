import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Box, Grid3x3, LayoutGrid } from 'lucide-react';
import { useTerminal } from '../store';
import { VolMarketProvider, useVolMarket } from '../lib/vol/market';
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
    <VolMarketProvider>
      <VolReplayProvider>
        <VolSelectionProvider>
          <Inner />
        </VolSelectionProvider>
      </VolReplayProvider>
    </VolMarketProvider>
  );
}

function Inner() {
  const [view, setView] = useState<SurfaceView>('SURFACE');
  const [preset, setPreset] = useState<CameraPreset>('PERSPECTIVE');
  const [presetNonce, setPresetNonce] = useState(0);
  const [surfMode, setSurfMode] = useState<SurfMode>('LIVE');
  const [xMode, setXMode] = useState<XAxisMode>('STRIKE');
  const vol = useVolState();                 // instrument + replay aware engine state
  const { snap, replayingAt } = useVolSnap();
  const market = useVolMarket();
  const sel = useVolSelection();

  // Slice indices belong to the previous market — clear on instrument switch.
  // Camera, view mode, axis mode and replay scrub survive: only data changes.
  useEffect(() => { sel.clear(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [market.instrument]);

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
      <section className="glass col-start-1 col-span-7 row-start-1 row-span-4 flex flex-col overflow-hidden">
        <InstrumentHeader />
        <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute left-3.5 top-2.5 z-10">
          <div className="section-title">{view === 'HEATMAP' ? 'IV Heatmap' : 'Implied Volatility Surface'}</div>
          <div className="mt-0.5 text-[9px] tracking-wide text-[color:var(--dim)]">{market.list.find((l) => l.instrument === market.instrument)?.label ?? market.instrument} · STRIKE × DTE × IV%</div>
        </div>

        <div className="absolute right-3 top-2.5 z-10 flex items-center gap-1">
          <Seg active={view === 'SURFACE'} onClick={() => setView('SURFACE')} icon={<Box size={11} />} label="Surface" />
          <Seg active={view === 'WIREFRAME'} onClick={() => setView('WIREFRAME')} icon={<Grid3x3 size={11} />} label="Wireframe" />
          <Seg active={view === 'HEATMAP'} onClick={() => setView('HEATMAP')} icon={<LayoutGrid size={11} />} label="Heatmap" />
        </div>

        {/* camera presets + data/axis modes — instant institutional viewpoints */}
        <div className="absolute right-3 top-[38px] z-10 flex items-center gap-1">
          {view !== 'HEATMAP' && PRESETS.map((p) => (
            <motion.button key={p.id} onClick={() => fly(p.id)}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="rounded-[4px] border px-1.5 py-0.5 text-[8px] font-semibold tracking-wide transition-colors"
              style={{ borderColor: preset === p.id ? 'rgba(139,92,246,0.4)' : 'var(--line)', color: preset === p.id ? 'var(--gold)' : 'var(--dim)' }}>
              {p.label}
            </motion.button>
          ))}
          <span className="mx-0.5 h-3 w-px bg-[color:var(--line)]" />
          {canToggleMode && (['LIVE', 'MODEL'] as SurfMode[]).map((m) => (
            <motion.button key={m} onClick={() => setSurfMode(m)}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
              title={m === 'LIVE' ? 'Raw chain surface — real market irregularities' : 'Smooth parametric fit'}
              className="rounded-[4px] border px-1.5 py-0.5 text-[8px] font-semibold tracking-wide transition-colors"
              style={{ borderColor: effMode === m ? 'rgba(90,167,255,0.4)' : 'var(--line)', color: effMode === m ? 'var(--info)' : 'var(--dim)' }}>
              {m}
            </motion.button>
          ))}
          <motion.button onClick={() => setXMode(xMode === 'STRIKE' ? 'MONEYNESS' : 'STRIKE')}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
            title="Toggle strike / log-moneyness axis"
            className="rounded-[4px] border border-[color:var(--line)] px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-[color:var(--dim)] transition-colors hover:text-[color:var(--text)]">
            {xMode === 'STRIKE' ? 'K' : 'ln(K/S)'}
          </motion.button>
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

        {/* Content crossfade — fade out old view, fade in new. Keyed only on
            surface-vs-heatmap so toggling Wireframe never remounts the R3F
            canvas (it's a prop on the same VolSurface, not a new view). */}
        <AnimatePresence mode="wait">
          <motion.div
            key={snap == null ? 'na' : view === 'HEATMAP' ? 'heatmap' : 'surface'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            {snap == null
              ? <MarketUnavailable />
              : view === 'HEATMAP'
                ? <IVHeatmap surfOverride={surfOverride} xMode={xMode} />
                : (
                  <Suspense fallback={<CanvasFallback />}>
                    <VolSurface wireframe={view === 'WIREFRAME'} preset={preset} presetNonce={presetNonce}
                      surfOverride={surfOverride} xMode={xMode} />
                  </Suspense>
                )}
          </motion.div>
        </AnimatePresence>
        </div>
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

// Compact institutional instrument header: selector + the numbers a trader
// needs BEFORE reading any chart. Generic — renders whatever index is selected.
function InstrumentHeader() {
  const market = useVolMarket();
  const { snap } = useVolSnap();
  const conn = useTerminal((s) => s.conn);

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—';
    const dt = new Date(`${d}T00:00:00+05:30`);
    return `${dt.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getUTCMonth()]}`;
  };
  const ctx = market.ctx;
  const isPrimary = ctx == null;
  const feed = isPrimary
    ? (conn === 'live' ? 'LIVE' : 'DEMO')
    : ctx.degraded?.includes('demo feed') ? 'DEMO' : ctx.live ? 'LIVE' : 'MODEL';
  const feedColor = feed === 'LIVE' ? 'var(--pos)' : feed === 'MODEL' ? 'var(--info)' : 'var(--gold)';

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[color:var(--line-soft)] px-3 py-1.5">
      <select value={market.instrument} onChange={(e) => market.setInstrument(e.target.value)}
        className="rounded-[5px] border border-[color:var(--line)] bg-[color:var(--bg2)] px-2 py-1 text-[11px] font-bold tracking-wide text-[color:var(--text)] outline-none">
        {market.list.map((i) => <option key={i.instrument} value={i.instrument} className="bg-[color:var(--bg1)]">{i.label}</option>)}
      </select>

      {snap ? (
        <div className="mono flex min-w-0 flex-1 items-center gap-3.5 overflow-x-auto text-[9px] text-[color:var(--dim)]">
          <Hd label="SPOT" value={snap.spot.toLocaleString('en-IN')} strong />
          <Hd label="ATM IV" value={`${(snap.vol.vix ?? 0).toFixed(1)}%`} />
          <Hd label="IV RANK" value={`${(snap.vol.ivRank ?? 0).toFixed(0)}`} />
          <Hd label="PCTILE" value={`${(snap.vol.ivPctile ?? 0).toFixed(0)}`} />
          <Hd label="EXP MOVE" value={`±${Math.round(snap.vol.emExpiry).toLocaleString('en-IN')}`} />
          <Hd label="WEEKLY" value={ctx?.weeklyExpiryDay ?? (isPrimary ? 'Tuesday' : '—')} />
          <Hd label="MONTHLY" value={fmtDate(ctx?.monthlyExpiry)} />
        </div>
      ) : (
        <span className="flex-1 text-[9px] text-[color:var(--dim)]">No market data recorded for this index yet.</span>
      )}

      <span className="flex shrink-0 items-center gap-1.5 rounded-[4px] border border-[color:var(--line)] px-1.5 py-0.5"
        title={ctx?.degraded?.length ? `Degraded inputs:\n${ctx.degraded.join('\n')}` : 'All inputs nominal'}>
        <span className="h-1.5 w-1.5 rounded-full pulse" style={{ background: feedColor }} />
        <span className="text-[7px] font-bold tracking-widest" style={{ color: feedColor }}>{feed}</span>
        {!!ctx?.degraded?.length && !ctx.degraded.includes('demo feed') && (
          <span className="text-[7px] font-bold text-[color:var(--gold)]">{ctx.degraded.length}⚠</span>
        )}
      </span>
    </div>
  );
}

function Hd({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex shrink-0 items-baseline gap-1">
      <span className="eyebrow text-[6.5px]">{label}</span>
      <span className={strong ? 'text-[10.5px] font-bold text-[color:var(--text)]' : 'font-semibold text-[color:var(--text)]'}>{value}</span>
    </span>
  );
}

function MarketUnavailable() {
  const market = useVolMarket();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
      <div className="text-[11px] font-bold text-[color:var(--gold)]">No data for {market.instrument} yet</div>
      <div className="text-[9.5px] leading-relaxed text-[color:var(--dim)]">
        {market.ctx?.degraded?.join(' · ') || 'The market data provider has no live quote or recorded history for this index. It will populate automatically once the backend can reach the market.'}
      </div>
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
    <motion.button
      onClick={onClick}
      whileHover={{ scale: active ? 1 : 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex items-center gap-1 rounded-[6px] border px-1.5 py-1 text-[9px] font-medium"
      style={{ borderColor: active ? 'rgba(139,92,246,0.35)' : 'var(--line)', color: active ? 'var(--gold)' : 'var(--dim)' }}
      aria-pressed={active}
    >
      {active && (
        <motion.span
          layoutId="surf-seg"
          className="absolute inset-0 rounded-[6px]"
          style={{ background: 'rgba(139,92,246,0.12)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1">{icon}{label}</span>
    </motion.button>
  );
}

function SurfaceBadge() {
  const { snap } = useVolSnap();
  const live = snap?.surface?.live;
  const label = live ? 'LIVE CHAIN IV' : 'PARAMETRIC MODEL';
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
