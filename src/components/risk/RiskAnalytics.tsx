import type { PortfolioState } from '../../lib/risk/types';
import { inr } from '../../lib/format';

// Presentation-only — VaR, risk contribution, margin, capital from the engine.
export function RiskAnalytics({ p }: { p: PortfolioState }) {
  const CONTRIB_COLOR: Record<string, string> = { Delta: 'var(--info)', Gamma: 'var(--violet)', Vega: 'var(--gold)' };
  return (
    <div className="flex h-full flex-col gap-2.5">
      {/* VaR headline */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="VaR · 95% · 1D" value={inr(p.var95)} color="var(--neg)" sub={`${(p.varPctEquity * 100).toFixed(2)}% equity`} />
        <Stat label="VaR · 99% · 1D" value={inr(p.var99)} color="var(--neg)" sub="tail" />
        <Stat label="MARGIN UTIL" value={`${(p.marginUtil * 100).toFixed(0)}%`} color={p.marginUtil > 0.6 ? 'var(--neg)' : p.marginUtil > 0.35 ? 'var(--gold)' : 'var(--pos)'} sub={inr(p.marginUsed)} />
      </div>

      {/* Risk contribution decomposition */}
      <div className="cell px-3 py-2">
        <div className="eyebrow mb-1.5 text-[8px]">RISK CONTRIBUTION · 1σ VARIANCE</div>
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {p.riskContributions.map((c) => (
            <div key={c.factor} style={{ width: `${c.pct}%`, background: CONTRIB_COLOR[c.factor] }} title={`${c.factor} ${c.pct}%`} />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between">
          {p.riskContributions.map((c) => (
            <span key={c.factor} className="flex items-center gap-1 text-[9px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: CONTRIB_COLOR[c.factor] }} />
              <span className="text-[color:var(--dim)]">{c.factor}</span>
              <span className="mono font-semibold text-[color:var(--text)]">{c.pct.toFixed(0)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Capital row */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="EQUITY" value={inr(p.equity)} color="var(--text)" />
        <Stat label="CAPITAL @ RISK" value={inr(p.capitalAtRisk)} color="var(--gold)" />
        <Stat label="PORTFOLIO HEAT" value={`${(p.heat * 100).toFixed(1)}%`} color={p.heat > 0.03 ? 'var(--gold)' : 'var(--pos)'} />
      </div>

      {/* Reasoning */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="eyebrow mb-1 text-[8px]">RISK ASSESSMENT</div>
        <div className="flex flex-col gap-1">
          {p.reasoning.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10.5px] leading-snug">
              <span className="mt-px text-[color:var(--gold)]">▸</span>
              <span className="text-[color:var(--dim)]">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="cell flex flex-col justify-center px-2.5 py-1.5">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="mono mt-0.5 text-[15px] font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[8px] text-[color:var(--faint)]">{sub}</div>}
    </div>
  );
}
