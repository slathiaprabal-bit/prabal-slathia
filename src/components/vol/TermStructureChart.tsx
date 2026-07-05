import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveCatmullRom } from 'd3-shape';
import { useVolSnap } from '../../lib/vol/replay';
import { useVolSelection } from '../../lib/vol/selection';
import { useSize } from '../../lib/useSize';

// ATM term structure at canonical tenors (1W 2W 1M 2M 3M 6M — only those inside
// the observed expiry range; nothing extrapolated). Today vs the real previous
// day and 5-day average, with a summary block answering the curve question
// directly: front, back, slope, curve type, strength.

const C_NOW = 'var(--gold)';
const C_YDAY = '#8b919c';
const C_AVG5 = 'var(--info)';
const C_STRIKE = 'var(--violet)';

interface TermData {
  labels: string[]; dte: number[]; today: number[];
  yday: (number | null)[] | null; avg5: (number | null)[] | null;
  strike: { label: string; values: (number | null)[] } | null;
}

export function TermStructureChart() {
  const { snap, replayingAt } = useVolSnap();
  const { strikeIdx } = useVolSelection();     // surface/heatmap click syncs here
  const { ref, width, height } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const hist = snap?.volHistory ?? null;
  const term = snap?.term;
  const surf = snap?.surface;

  const data = useMemo<TermData | null>(() => {
    // Selected-strike IV interpolated from the surface onto the chart's DTEs —
    // the "highlight a strike across maturities" overlay.
    const strikeCurve = (dtes: number[]): TermData['strike'] => {
      if (strikeIdx == null || !surf || strikeIdx >= surf.strikes.length) return null;
      const col = surf.iv.map((row) => row[strikeIdx]);
      const ex = surf.expiries;
      const values = dtes.map((d) => {
        if (d < ex[0] - 1e-9 || d > ex[ex.length - 1] + 1e-9) return null;
        let j = 0;
        while (j < ex.length - 2 && ex[j + 1] < d) j++;
        const t = (d - ex[j]) / (ex[j + 1] - ex[j] || 1);
        return col[j] + (col[j + 1] - col[j]) * Math.max(0, Math.min(1, t));
      });
      return { label: `K ${Math.round(surf.strikes[strikeIdx])}`, values };
    };

    // Live: canonical tenor curves from the history store. Replay: the raw ATM
    // term curve recorded at that moment (tenor history is a daily artifact).
    if (!replayingAt && hist?.tenors) {
      const t = hist.tenors;
      const idx = t.today.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
      if (idx.length >= 2) {
        const dte = idx.map((i) => t.dte[i]);
        return {
          labels: idx.map((i) => t.labels[i]),
          dte,
          today: idx.map((i) => t.today[i] as number),
          yday: t.yesterday ? idx.map((i) => t.yesterday![i]) : null,
          avg5: t.avg5 ? idx.map((i) => t.avg5![i]) : null,
          strike: strikeCurve(dte),
        };
      }
    }
    if (term?.dte && term.dte.length >= 2) {
      return {
        labels: term.dte.map((d) => `${Math.round(d)}d`), dte: term.dte, today: term.iv,
        yday: null, avg5: null, strike: strikeCurve(term.dte),
      };
    }
    return null;
  }, [hist, term, replayingAt, strikeIdx, surf]);

  const shape = useMemo(() => {
    if (!data) return null;
    const front = data.today[0], back = data.today[data.today.length - 1];
    const slope = back - front;
    const a = Math.abs(slope);
    const strength = a < 0.4 ? 'Flat' : a < 1.5 ? 'Mild' : a < 3 ? 'Moderate' : 'Steep';
    const kind = slope >= 0.4 ? 'Contango' : slope <= -0.4 ? 'Backwardation' : 'Flat';
    // Steepening/flattening vs yesterday, when both endpoints exist.
    let dSlope: number | null = null;
    if (data.yday && data.yday[0] != null && data.yday[data.yday.length - 1] != null) {
      dSlope = slope - ((data.yday[data.yday.length - 1] as number) - (data.yday[0] as number));
    }
    return { front, back, slope, strength, kind, dSlope };
  }, [data]);

  if (!data || !shape) {
    return <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--dim)]">Awaiting term data…</div>;
  }

  const kindColor = shape.kind === 'Contango' ? 'var(--pos)' : shape.kind === 'Backwardation' ? 'var(--neg)' : 'var(--dim)';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-1 flex items-center gap-2.5 text-[8px] tracking-wide text-[color:var(--dim)]">
        <Swatch color={C_NOW} label="ATM" />
        <Swatch color={C_YDAY} label="Yesterday" dashed muted={!data.yday} />
        <Swatch color={C_AVG5} label="5-Day Avg" dashed muted={!data.avg5} />
        {data.strike && <Swatch color={C_STRIKE} label={data.strike.label} />}
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        <div ref={ref} className="relative min-h-0 min-w-0 flex-1">
          {width > 20 && height > 20 && (
            <Plot width={width} height={height} data={data} hover={hover} setHover={setHover} />
          )}
        </div>

        {/* summary — the curve's answer in five numbers */}
        <div className="flex w-[86px] shrink-0 flex-col justify-center gap-1.5 border-l border-[color:var(--line-soft)] pl-2">
          <SumRow label="FRONT IV" value={`${shape.front.toFixed(1)}%`} />
          <SumRow label="BACK IV" value={`${shape.back.toFixed(1)}%`} />
          <SumRow label="SLOPE" value={`${shape.slope >= 0 ? '+' : ''}${shape.slope.toFixed(1)}`} color={kindColor} />
          <SumRow label="CURVE" value={shape.kind} color={kindColor} />
          <SumRow label="STRENGTH" value={shape.strength} />
          {shape.dSlope != null && Math.abs(shape.dSlope) >= 0.15 && (
            <SumRow label="VS YDAY" value={shape.dSlope > 0 ? 'Steepening' : 'Flattening'}
              color={shape.dSlope > 0 ? 'var(--pos)' : 'var(--gold)'} />
          )}
        </div>
      </div>
    </div>
  );
}

function Plot({ width, height, data, hover, setHover }: {
  width: number; height: number; data: TermData; hover: number | null; setHover: (i: number | null) => void;
}) {
  const pad = { t: 10, r: 8, b: 16, l: 26 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const n = data.today.length;
  const xAt = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const extra = [...(data.yday ?? []), ...(data.avg5 ?? []), ...(data.strike?.values ?? [])].filter((v): v is number => v != null);
  const all = [...data.today, ...extra];
  const yPad = (Math.max(...all) - Math.min(...all)) * 0.2 || 0.8;
  const ys = scaleLinear().domain([Math.min(...all) - yPad, Math.max(...all) + yPad]).range([h, 0]);

  const mkSeries = (series: (number | null)[]) => {
    const pts = series.map((v, i) => (v != null ? ([xAt(i), ys(v)] as [number, number]) : null)).filter(Boolean) as [number, number][];
    return pts.length >= 2 ? (d3line<[number, number]>().x((d) => d[0]).y((d) => d[1]).curve(curveCatmullRom)(pts) ?? '') : '';
  };

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const px = e.nativeEvent.offsetX - pad.l;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / w) * (n - 1)))));
  };

  const hi = hover;
  return (
    <>
      <svg width={width} height={height} className="absolute inset-0">
        <g transform={`translate(${pad.l},${pad.t})`}>
          {ys.ticks(3).map((t) => (
            <g key={t}>
              <line x1={0} x2={w} y1={ys(t)} y2={ys(t)} stroke="rgba(255,255,255,0.045)" />
              <text x={-5} y={ys(t) + 3} fontSize="7.5" fill="#5b616b" textAnchor="end">{t.toFixed(0)}</text>
            </g>
          ))}

          {data.avg5 && <path d={mkSeries(data.avg5)} fill="none" stroke={C_AVG5} strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />}
          {data.yday && <path d={mkSeries(data.yday)} fill="none" stroke={C_YDAY} strokeWidth={1.1} strokeDasharray="4 3" opacity={0.75} />}
          {data.strike && <path d={mkSeries(data.strike.values)} fill="none" stroke="var(--violet)" strokeWidth={1.4} opacity={0.9} />}
          <path d={mkSeries(data.today)} fill="none" stroke={C_NOW} strokeWidth={1.8} strokeLinecap="round" />

          {data.today.map((v, i) => (
            <g key={i}>
              <circle cx={xAt(i)} cy={ys(v)} r={hi === i ? 3.2 : 2.2} fill={C_NOW} stroke="#000" strokeWidth={0.6} />
              <text x={xAt(i)} y={h + 12} fontSize="7.5" fill={hi === i ? '#c9ced6' : '#5b616b'} textAnchor="middle" fontWeight={700}>
                {data.labels[i]}
              </text>
            </g>
          ))}

          {hi != null && <line x1={xAt(hi)} x2={xAt(hi)} y1={0} y2={h} stroke="rgba(255,255,255,0.25)" strokeWidth={0.6} />}
          <rect x={0} y={0} width={w} height={h} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </g>
      </svg>

      {hi != null && (
        <div className="pointer-events-none absolute z-10 rounded-[5px] border border-[color:var(--line)] bg-black/85 px-2 py-1.5"
          style={{ left: Math.min(width - 118, Math.max(0, pad.l + xAt(hi) + 8)), top: 2 }}>
          <div className="mono text-[9px] font-bold text-[color:var(--text)]">{data.labels[hi]} · {Math.round(data.dte[hi])}d</div>
          <Row label="Today" value={`${data.today[hi].toFixed(2)}%`} color="var(--gold)" />
          {data.yday?.[hi] != null && (
            <Row label="Δ 1d" value={`${data.today[hi] - (data.yday[hi] as number) >= 0 ? '+' : ''}${(data.today[hi] - (data.yday[hi] as number)).toFixed(2)}`}
              color={data.today[hi] - (data.yday[hi] as number) >= 0 ? 'var(--neg)' : 'var(--pos)'} />
          )}
          {data.avg5?.[hi] != null && (
            <Row label="vs 5d avg" value={`${data.today[hi] - (data.avg5[hi] as number) >= 0 ? '+' : ''}${(data.today[hi] - (data.avg5[hi] as number)).toFixed(2)}`}
              color={data.today[hi] - (data.avg5[hi] as number) >= 0 ? 'var(--neg)' : 'var(--pos)'} />
          )}
          {data.strike?.values[hi] != null && (
            <Row label={data.strike.label} value={`${(data.strike.values[hi] as number).toFixed(2)}%`} color="var(--violet)" />
          )}
        </div>
      )}
    </>
  );
}

function SumRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="eyebrow text-[6.5px]">{label}</div>
      <div className="text-[10px] font-bold leading-tight" style={{ color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[8px]">
      <span className="text-[color:var(--dim)]">{label}</span>
      <span className="mono font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

function Swatch({ color, label, dashed, muted }: { color: string; label: string; dashed?: boolean; muted?: boolean }) {
  return (
    <span className="flex items-center gap-1" style={{ opacity: muted ? 0.35 : 1 }}>
      <span className="inline-block h-[2px] w-3.5"
        style={{ background: dashed ? `repeating-linear-gradient(90deg,${color} 0 3px,transparent 3px 5px)` : color }} />
      {label}
    </span>
  );
}
