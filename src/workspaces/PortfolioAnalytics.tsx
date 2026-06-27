import { Panel } from '../components/ui/Panel';
import { useTerminal } from '../store';
import { Gauge } from '../components/ui/Gauge';
import { MonteCarloHist } from '../components/charts/MonteCarloHist';
import { pct, inr } from '../lib/format';

// Phase 1: capital efficiency, heat, margin and the Monte-Carlo return
// distribution. Phase 5 adds scenario analysis and margin optimisation.
export function PortfolioAnalytics() {
  const risk = useTerminal((s) => s.snap?.risk);
  const mc = useTerminal((s) => s.snap?.montecarlo);

  const heat = risk?.portfolioHeat ?? 0;
  const margin = risk?.marginUsage ?? 0;
  const kelly = risk?.kellyPct ?? 0;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2.5">
      <Panel
        title="Capital Efficiency"
        accent="#2f7bff"
        className="col-start-1 col-span-5 row-start-1 row-span-3"
        delay={0.04}
      >
        <div className="flex h-full flex-col justify-center gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Gauge value={heat / 0.05} label="HEAT" display={pct(heat, 1)} color="#16f5b0" size={96} />
            <Gauge value={margin / 0.6} label="MARGIN" display={pct(margin, 0)} color="#3fd6f5" size={96} />
            <Gauge value={kelly} label="KELLY" display={pct(kelly, 0)} color="#c084fc" size={96} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="EQUITY" value={inr(risk?.equity ?? 0)} />
            <Mini label="@ RISK" value={inr(risk?.capitalAtRisk ?? 0)} />
            <Mini label="MARGIN USED" value={inr(risk?.marginUsed ?? 0)} />
          </div>
        </div>
      </Panel>

      <Panel
        title="Drawdown Profile"
        accent="#ffb020"
        className="col-start-1 col-span-5 row-start-4 row-span-3"
        delay={0.08}
      >
        <div className="grid h-full grid-cols-2 content-center gap-2">
          <Mini label="MEDIAN MAX DD" value={pct(mc?.medianMaxDD ?? 0, 1)} />
          <Mini label="WORST MAX DD" value={pct(mc?.worstMaxDD ?? 0, 1)} />
          <Mini label="E[DRAWDOWN]" value={pct(mc?.expectedDrawdown ?? 0, 1)} />
          <Mini label="P(RUIN)" value={pct(mc?.pRuin ?? 0, 1)} />
          <Mini label="MEDIAN RETURN" value={`${(mc?.medianReturnPct ?? 0).toFixed(1)}%`} />
          <Mini label="START CAPITAL" value={inr(mc?.startCapital ?? risk?.equity ?? 0)} />
        </div>
      </Panel>

      <Panel
        title="Monte-Carlo · 50-Trade Return Distribution"
        accent="#16f5b0"
        className="col-start-6 col-span-7 row-start-1 row-span-6"
        delay={0.12}
      >
        <MonteCarloHist />
      </Panel>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] py-1.5 text-center">
      <div className="eyebrow text-[9px]">{label}</div>
      <div className="mono text-sm font-semibold text-[color:var(--text)]">{value}</div>
    </div>
  );
}
