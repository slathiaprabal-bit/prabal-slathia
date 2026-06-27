import type { DealerState, GammaRegime } from '../../lib/dealer/types';

const REGIME_COLOR: Record<GammaRegime, string> = { LONG_GAMMA: 'var(--pos)', SHORT_GAMMA: 'var(--neg)' };

// Presentation-only — dealer gamma profile + positioning stats from the engine.
export function DealerPositioning({ d }: { d: DealerState }) {
  const rc = REGIME_COLOR[d.gammaRegime];
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* headline stats */}
      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="NET GEX" value={`${(d.netGex / 1e7).toFixed(1)}`} unit="₹Cr/1%" color={rc} />
        <Stat label="GAMMA" value={d.gammaRegime === 'LONG_GAMMA' ? 'LONG' : 'SHORT'} color={rc} />
        <Stat label="γ-FLIP" value={d.gammaFlip ? Math.round(d.gammaFlip).toLocaleString('en-IN') : '—'} color="var(--violet)" />
        <Stat label="MAX PAIN" value={Math.round(d.maxPain).toLocaleString('en-IN')} color="var(--gold)" />
      </div>

      {/* GEX profile */}
      <div className="min-h-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow text-[8px]">DEALER GAMMA EXPOSURE · BY STRIKE</span>
          <span className="flex gap-2 text-[7px] text-[color:var(--dim)]">
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} />long</span>
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--neg)' }} />short</span>
          </span>
        </div>
        <GexProfile d={d} />
      </div>

      {/* vanna / charm + reasoning */}
      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="VANNA EXPOSURE" value={fmtK(d.vannaExposure)} color={d.vannaExposure >= 0 ? 'var(--pos)' : 'var(--neg)'} />
        <Stat label="CHARM EXPOSURE" value={fmtK(d.charmExposure)} color={d.charmExposure >= 0 ? 'var(--pos)' : 'var(--neg)'} />
      </div>
      <div className="cell px-2.5 py-1.5">
        {d.reasoning.slice(0, 2).map((r, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px] leading-snug">
            <span className="mt-px shrink-0" style={{ color: rc }}>▸</span>
            <span className="text-[color:var(--dim)]">{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GexProfile({ d }: { d: DealerState }) {
  const rows = [...d.profile].sort((a, b) => b.strike - a.strike);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.gex)), 1);
  const mark = (k: number) =>
    near(k, d.maxPain) ? 'var(--gold)' : near(k, d.callWall) ? 'var(--neg)' : near(k, d.putWall) ? 'var(--pos)' : 'var(--dim)';
  return (
    <div className="flex h-full min-h-0 flex-col gap-px overflow-auto">
      {rows.map((r) => {
        const w = (Math.abs(r.gex) / maxAbs) * 50;
        const pos = r.gex >= 0;
        const atSpot = near(r.strike, d.spot, 1);
        return (
          <div key={r.strike} className="flex items-center gap-1.5" style={atSpot ? { background: 'rgba(255,255,255,0.04)' } : undefined}>
            <span className="mono w-12 shrink-0 text-right text-[9px]" style={{ color: mark(r.strike), fontWeight: atSpot ? 700 : 400 }}>
              {Math.round(r.strike).toLocaleString('en-IN')}
            </span>
            <div className="relative h-2 flex-1">
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
              <div className="absolute top-0 h-full rounded-[1px]" style={{ background: pos ? 'var(--pos)' : 'var(--neg)', width: `${w}%`, left: pos ? '50%' : undefined, right: pos ? undefined : '50%' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function near(a: number, b: number, tol = 0.6) { return Math.abs(a - b) <= (b ? b * 0.001 + tol : tol); }
function fmtK(v: number) { const a = Math.abs(v); return `${v < 0 ? '-' : ''}${a >= 1e7 ? (a / 1e7).toFixed(1) + 'Cr' : a >= 1e5 ? (a / 1e5).toFixed(1) + 'L' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'k' : a.toFixed(0)}`; }

function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="cell flex flex-col justify-center px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className="mono text-[13px] font-bold leading-tight" style={{ color }}>{value}{unit && <span className="ml-0.5 text-[7px] text-[color:var(--faint)]">{unit}</span>}</div>
    </div>
  );
}
