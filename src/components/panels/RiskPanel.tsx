import { useTerminal } from '../../store';
import { Gauge } from '../ui/Gauge';
import { MonteCarloHist } from '../charts/MonteCarloHist';
import { pct, inr } from '../../lib/format';

export function RiskPanel() {
  const risk = useTerminal((s) => s.snap?.risk);
  const mc = useTerminal((s) => s.snap?.montecarlo);
  if (!risk) return null;

  const heat = risk.portfolioHeat ?? 0;
  const margin = risk.marginUsage ?? 0;
  const ruin = risk.probRuin ?? mc?.pRuin ?? 0;
  const edd = risk.expectedDrawdown ?? mc?.expectedDrawdown ?? 0;
  const kelly = risk.kellyPct ?? 0;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-5 gap-1">
        <Gauge value={heat / 0.05} label="HEAT" display={pct(heat, 1)} color="#27d17c" size={84} />
        <Gauge value={margin / 0.6} label="MARGIN" display={pct(margin, 0)} color="#5aa9ff" size={84} />
        <Gauge value={ruin / 0.1} label="P(RUIN)" display={pct(ruin, 1)} color="#f04668" size={84} />
        <Gauge value={edd / 0.2} label="E[DD]" display={pct(edd, 1)} color="#f4b740" size={84} />
        <Gauge value={kelly} label="KELLY" display={pct(kelly, 0)} color="#c79bff" size={84} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini label="CAPITAL @ RISK" value={inr(risk.capitalAtRisk)} />
        <Mini label="MARGIN USED" value={inr(risk.marginUsed)} />
        <Mini label="EQUITY" value={inr(risk.equity)} />
      </div>

      <div className="min-h-0 flex-1">
        <div className="eyebrow mb-1">Monte-Carlo · 50-trade return distribution</div>
        <MonteCarloHist />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="cell py-1.5">
      <div className="eyebrow text-[9px]">{label}</div>
      <div className="mono text-sm font-semibold text-[color:var(--text)]">{value}</div>
    </div>
  );
}
