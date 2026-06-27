import { useTerminal } from '../../store';
import { AnimatedNumber } from '../ui/AnimatedNumber';

// Reference-style 8-cell volatility metrics grid: label · value · tag.
// All values derive from the live snapshot (vol / smile / term).
export function VolMetricsGrid() {
  const vol = useTerminal((s) => s.snap?.vol);
  const spot = useTerminal((s) => s.snap?.spot ?? 0);
  const smile = useTerminal((s) => s.snap?.smile);
  const term = useTerminal((s) => s.snap?.term);
  if (!vol) return null;

  const ivr = vol.ivRank ?? 0;
  const ivrTag = ivr >= 70 ? ['High', 'var(--neg)'] : ivr >= 45 ? ['Moderate', 'var(--gold)'] : ['Low', 'var(--pos)'];
  const ivp = vol.ivPctile ?? 0;
  const ivpTag = ivp >= 70 ? ['High', 'var(--neg)'] : ivp >= 45 ? ['Moderate', 'var(--gold)'] : ['Low', 'var(--pos)'];
  const vrp = vol.vrp ?? 0;
  const emPct = spot ? (vol.emExpiry / spot) * 100 : 0;
  const pInside = (vol.pInside1 ?? 0) * 100;

  // Skew proxy: OTM-put wing IV minus OTM-call wing IV (25Δ approximation).
  let skew = 0;
  if (smile?.strikes && smile.iv.length) {
    const ks = smile.strikes;
    const putK = spot * 0.95, callK = spot * 1.05;
    const at = (target: number) => {
      let bi = 0, bd = Infinity;
      ks.forEach((k, i) => { const d = Math.abs(k - target); if (d < bd) { bd = d; bi = i; } });
      return smile.iv[bi];
    };
    skew = at(callK) - at(putK); // negative = puts richer = downside skew
  }
  const skewTag = skew < -0.3 ? ['Bearish', 'var(--neg)'] : skew > 0.3 ? ['Bullish', 'var(--pos)'] : ['Neutral', 'var(--dim)'];

  // Term structure shape from the ATM term curve slope.
  const tIv = term?.iv ?? [];
  const upward = tIv.length > 1 && tIv[tIv.length - 1] >= tIv[0];
  const termTag = upward ? ['Normal', 'var(--pos)'] : ['Inverted', 'var(--gold)'];

  return (
    <div className="grid h-full grid-cols-2 grid-rows-4 gap-px overflow-hidden rounded-[6px] bg-[color:var(--line)]">
      <Cell label="IV RANK" value={<AnimatedNumber value={ivr} format={(v) => v.toFixed(0)} />} tag={ivrTag[0]} tagColor={ivrTag[1]} />
      <Cell label="IV PERCENTILE" value={<AnimatedNumber value={ivp} format={(v) => `${v.toFixed(0)}th`} />} tag={ivpTag[0]} tagColor={ivpTag[1]} />
      <Cell label="HV (20D)" value={<AnimatedNumber value={vol.hv20 ?? 0} format={(v) => `${v.toFixed(2)}%`} />} tag="Realized" tagColor="var(--dim)" />
      <Cell label="VRP" value={<AnimatedNumber value={vrp} format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`} />} tag={vrp >= 0 ? 'Positive' : 'Negative'} tagColor={vrp >= 0 ? 'var(--pos)' : 'var(--neg)'} valueColor={vrp >= 0 ? 'var(--pos)' : 'var(--neg)'} />
      <Cell label="EXPECTED MOVE" value={<AnimatedNumber value={emPct} format={(v) => `±${v.toFixed(2)}%`} />} tag={`±${vol.emExpiry.toLocaleString('en-IN', { maximumFractionDigits: 0 })} pts`} tagColor="#5aa9ff" />
      <Cell label="PROB. INSIDE" value={<AnimatedNumber value={pInside} format={(v) => `${v.toFixed(1)}%`} />} tag="1σ range" tagColor="var(--dim)" />
      <Cell label="SKEW (25Δ)" value={<AnimatedNumber value={skew} format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} />} tag={skewTag[0]} tagColor={skewTag[1]} valueColor={skewTag[1]} />
      <Cell label="TERM STRUCTURE" value={<span className="text-[15px] font-bold" style={{ color: termTag[1] }}>{termTag[0]}</span>} tag="" tagColor="var(--dim)" spark={tIv} sparkColor={termTag[1]} />
    </div>
  );
}

function Cell({ label, value, tag, tagColor, valueColor, spark, sparkColor }: {
  label: string; value: React.ReactNode; tag: string; tagColor: string;
  valueColor?: string; spark?: number[]; sparkColor?: string;
}) {
  return (
    <div className="flex flex-col justify-center gap-0.5 bg-[color:var(--panel)] px-3 py-2">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="flex items-end justify-between gap-1">
        <span className="mono text-[17px] font-bold leading-none" style={{ color: valueColor ?? 'var(--text)' }}>{value}</span>
        {spark && spark.length > 1 && <Spark data={spark} color={sparkColor ?? 'var(--pos)'} />}
      </div>
      {tag && <div className="text-[9.5px] font-medium" style={{ color: tagColor }}>{tag}</div>}
    </div>
  );
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 40, h = 14;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
