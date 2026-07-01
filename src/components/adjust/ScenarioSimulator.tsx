import { useMemo, useState } from 'react';
import { scenarioCurve } from '../../lib/adjust/scenario';
import { inr } from './shared';
import type { Candidate, Position } from '../../lib/adjust/types';

const SERIES = ['var(--dim)', 'var(--pos)', 'var(--gold)', 'var(--info)'];

// Recalculates the current position and each recommended adjustment for a range
// of underlying moves, at a chosen IV shift and remaining DTE — side by side.
export function ScenarioSimulator({ position, base, candidates }: {
  position: Position; base: Candidate['resultLegs']; candidates: Candidate[];
}) {
  const [ivShift, setIvShift] = useState(0);    // vol points
  const [days, setDays] = useState(Math.max(0, position.dte - 1));

  const cmp = candidates.slice(0, 3);
  const curves = useMemo(() => {
    const iv = ivShift / 100;
    const mk = (legs: Position['legs']) => scenarioCurve(legs, position, iv, days, 49, 0.08);
    return [
      { name: 'Current', color: SERIES[0], pts: mk(base) },
      ...cmp.map((c, i) => ({ name: `#${candidates.indexOf(c) + 1}`, color: SERIES[i + 1], pts: mk(c.resultLegs) })),
    ];
  }, [position, base, cmp, ivShift, days]);

  const allPnl = curves.flatMap((s) => s.pts.map((p) => p.pnl));
  const lo = Math.min(...allPnl, 0), hi = Math.max(...allPnl, 0);
  const W = 100, H = 100;
  const x = (i: number, n: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * H;
  const zeroY = y(0);

  return (
    <div className="flex h-full min-h-0 gap-3">
      {/* controls + legend */}
      <div className="flex w-40 shrink-0 flex-col gap-2">
        <div className="cell px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-[7.5px]">IV SHIFT</span>
            <span className="mono text-[11px] font-bold" style={{ color: ivShift >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{ivShift >= 0 ? '+' : ''}{ivShift} pts</span>
          </div>
          <input type="range" min={-8} max={8} value={ivShift} onChange={(e) => setIvShift(Number(e.target.value))} className="mt-1 w-full accent-[color:var(--violet)]" />
        </div>
        <div className="cell px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-[7.5px]">DAYS LEFT</span>
            <span className="mono text-[11px] font-bold text-[color:var(--text)]">{days}d</span>
          </div>
          <input type="range" min={0} max={position.dte} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 w-full accent-[color:var(--gold)]" />
        </div>
        <div className="flex flex-col gap-1">
          {curves.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 text-[9px]">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              <span className="text-[color:var(--dim)]">{s.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto text-[7.5px] leading-snug text-[color:var(--faint)]">
          P&amp;L vs current mark across ±8% moves, at the chosen IV shift and days remaining.
        </div>
      </div>

      {/* multi-line P&L chart */}
      <div className="min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeWidth={0.4} strokeDasharray="1.5 1.5" />
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="rgba(255,255,255,0.10)" strokeWidth={0.4} />
          {curves.map((s) => (
            <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={s.name === 'Current' ? 0.9 : 1.1}
              strokeDasharray={s.name === 'Current' ? '2 1.5' : undefined}
              points={s.pts.map((p, i) => `${x(i, s.pts.length)},${y(p.pnl)}`).join(' ')} />
          ))}
        </svg>
        <div className="mono mt-0.5 flex justify-between text-[7.5px] text-[color:var(--faint)]">
          <span>−8%</span><span>spot {position.spot.toLocaleString('en-IN')}</span><span>+8%</span>
        </div>
        <div className="mono mt-0.5 flex flex-wrap justify-center gap-x-3 text-[8px]">
          {curves.map((s) => {
            const atDown = s.pts[Math.floor(s.pts.length * 0.15)]?.pnl ?? 0; // ~−5.5%
            return <span key={s.name} style={{ color: s.color }}>{s.name} @−5%: {inr(atDown)}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
