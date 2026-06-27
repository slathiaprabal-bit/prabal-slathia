import type { PortfolioState, Exposure } from '../../lib/risk/types';

const EXP_COLOR: Record<Exposure, string> = { LONG: 'var(--pos)', SHORT: 'var(--neg)', NEUTRAL: 'var(--gold)' };

// Presentation-only — renders the Risk Engine's portfolio Greeks.
export function GreeksAggregation({ p }: { p: PortfolioState }) {
  const g = p.greeks;
  const cells: [string, string, string, string][] = [
    ['Δ DELTA', fmt(g.delta, 2), '₹/pt', g.delta >= 0 ? 'var(--pos)' : 'var(--neg)'],
    ['Γ GAMMA', fmt(g.gamma, 4), '₹/pt²', g.gamma >= 0 ? 'var(--pos)' : 'var(--neg)'],
    ['Θ THETA', fmt(g.theta, 0), '₹/day', g.theta >= 0 ? 'var(--pos)' : 'var(--neg)'],
    ['ν VEGA', fmt(g.vega, 0), '₹/vol', g.vega >= 0 ? 'var(--pos)' : 'var(--neg)'],
    ['CHARM', fmt(g.charm, 3), 'Δ/day', 'var(--text)'],
    ['VANNA', fmt(g.vanna, 3), 'Δ/vol', 'var(--text)'],
    ['VOMMA', fmt(g.vomma, 3), 'ν/vol', 'var(--text)'],
    ['SPEED', fmt(g.speed, 5), 'Γ/pt', 'var(--text)'],
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      {/* exposure summary */}
      <div className="grid grid-cols-3 gap-2">
        <Bias label="DELTA BIAS" value={p.deltaBias} />
        <Bias label="VEGA BIAS" value={p.vegaBias} />
        <div className="cell flex flex-col justify-center px-2.5 py-1.5">
          <div className="eyebrow text-[8px]">PORTFOLIO BETA</div>
          <div className="mono mt-0.5 text-[14px] font-bold" style={{ color: Math.abs(p.beta) < 0.1 ? 'var(--gold)' : p.beta > 0 ? 'var(--pos)' : 'var(--neg)' }}>
            {p.beta >= 0 ? '+' : ''}{p.beta.toFixed(2)}
          </div>
        </div>
      </div>

      {/* greek grid */}
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-4 gap-px overflow-hidden rounded-[6px] bg-[color:var(--line)]">
        {cells.map(([label, value, unit, color]) => (
          <div key={label} className="flex flex-col justify-center bg-[color:var(--panel)] px-3 py-1.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-[8px]">{label}</span>
              <span className="text-[7px] text-[color:var(--faint)]">{unit}</span>
            </div>
            <span className="mono text-[15px] font-bold leading-tight" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>
      <div className="text-[8px] tracking-wide text-[color:var(--faint)]">Portfolio Greeks · {p.lots} lot{p.lots !== 1 ? 's' : ''} of recommended structure</div>
    </div>
  );
}

function Bias({ label, value }: { label: string; value: Exposure }) {
  return (
    <div className="cell flex flex-col justify-center px-2.5 py-1.5">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="mt-0.5 text-[14px] font-bold" style={{ color: EXP_COLOR[value] }}>{value}</div>
    </div>
  );
}

function fmt(v: number, dp: number) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return v.toFixed(dp);
}
