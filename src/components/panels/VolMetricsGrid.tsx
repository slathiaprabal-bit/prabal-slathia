import { useVolState } from '../../lib/vol/replay';
import { AnimatedNumber } from '../ui/AnimatedNumber';

// Presentation-only. Renders the Volatility Engine's VolState — all volatility
// math (ATM IV, skew, term slope, etc.) lives in lib/vol, never here.
export function VolMetricsGrid() {
  const v = useVolState();
  if (!v) return null;

  const ivrTag = tag(v.ivRank);
  const ivpTag = tag(v.ivPctile);
  const skewTag = v.skew < -0.3 ? ['Bearish', 'var(--neg)'] : v.skew > 0.3 ? ['Bullish', 'var(--pos)'] : ['Neutral', 'var(--dim)'];
  const termTag = v.termSlope >= 0 ? ['Contango', 'var(--pos)'] : ['Inverted', 'var(--gold)'];

  return (
    <div className="grid h-full grid-cols-2 grid-rows-4 gap-px overflow-hidden rounded-[6px] bg-[color:var(--line)]">
      <Cell label="IV RANK" value={<AnimatedNumber value={v.ivRank} format={(x) => x.toFixed(0)} />} tag={ivrTag[0]} tagColor={ivrTag[1]} />
      <Cell label="IV PERCENTILE" value={<AnimatedNumber value={v.ivPctile} format={(x) => `${x.toFixed(0)}th`} />} tag={ivpTag[0]} tagColor={ivpTag[1]} />
      <Cell label="ATM IV" value={<AnimatedNumber value={v.atmIv} format={(x) => `${x.toFixed(1)}%`} />} tag="Implied" tagColor="var(--dim)" />
      <Cell label="REALIZED VOL" value={<AnimatedNumber value={v.hv} format={(x) => `${x.toFixed(1)}%`} />} tag="HV-20" tagColor="var(--dim)" />
      <Cell label="VRP" value={<AnimatedNumber value={v.vrp} format={(x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`} />} tag={v.vrp >= 0 ? 'Positive' : 'Negative'} tagColor={v.vrp >= 0 ? 'var(--pos)' : 'var(--neg)'} valueColor={v.vrp >= 0 ? 'var(--pos)' : 'var(--neg)'} />
      <Cell label="EXPECTED MOVE" value={<AnimatedNumber value={v.emPct} format={(x) => `±${x.toFixed(2)}%`} />} tag={`±${v.emExpiry.toLocaleString('en-IN', { maximumFractionDigits: 0 })} pts`} tagColor="var(--info)" />
      <Cell label="SKEW (25Δ)" value={<AnimatedNumber value={v.skew} format={(x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`} />} tag={skewTag[0]} tagColor={skewTag[1]} valueColor={skewTag[1]} />
      <Cell label="TERM STRUCTURE" value={<span className="text-[15px] font-bold" style={{ color: termTag[1] }}>{termTag[0]}</span>} tag={`slope ${v.termSlope >= 0 ? '+' : ''}${v.termSlope.toFixed(1)}`} tagColor="var(--dim)" />
    </div>
  );
}

function tag(v: number): [string, string] {
  return v >= 70 ? ['High', 'var(--neg)'] : v >= 45 ? ['Moderate', 'var(--gold)'] : ['Low', 'var(--pos)'];
}

function Cell({ label, value, tag, tagColor, valueColor }: {
  label: string; value: React.ReactNode; tag: string; tagColor: string; valueColor?: string;
}) {
  return (
    <div className="flex flex-col justify-center gap-0.5 bg-[color:var(--panel)] px-3 py-2">
      <div className="eyebrow text-[8px]">{label}</div>
      <span className="mono text-[17px] font-bold leading-none" style={{ color: valueColor ?? 'var(--text)' }}>{value}</span>
      {tag && <div className="text-[9.5px] font-medium" style={{ color: tagColor }}>{tag}</div>}
    </div>
  );
}
