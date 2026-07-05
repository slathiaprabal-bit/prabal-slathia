import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveCatmullRom } from 'd3-shape';
import { useTerminal } from '../../store';
import { useSize } from '../../lib/useSize';

// ATM term structure at canonical tenors (1W 2W 1M 2M 3M 6M — only those inside
// the observed expiry range; nothing extrapolated). Today's curve vs the real
// previous-day curve, with a contango/backwardation strength read.

const C_NOW = 'var(--gold)';
const C_YDAY = '#8b919c';

export function TermStructureChart() {
  const snap = useTerminal((s) => s.snap);
  const { ref, width, height } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const hist = snap?.volHistory ?? null;
  const term = snap?.term;

  // Preferred source: canonical tenors from the history store. Fallback (backend
  // not yet serving volHistory): raw ATM term curve from the surface.
  const data = useMemo(() => {
    if (hist?.tenors) {
      const t = hist.tenors;
      const idx = t.today.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
      if (idx.length >= 2) {
        return {
          labels: idx.map((i) => t.labels[i]),
          dte: idx.map((i) => t.dte[i]),
          today: idx.map((i) => t.today[i] as number),
          yday: t.yesterday ? idx.map((i) => t.yesterday![i]) : null,
        };
      }
    }
    if (term?.dte && term.dte.length >= 2) {
      return { labels: term.dte.map((d) => `${Math.round(d)}d`), dte: term.dte, today: term.iv, yday: null };
    }
    return null;
  }, [hist, term]);

  const shape = useMemo(() => {
    if (!data) return null;
    const front = data.today[0], back = data.today[data.today.length - 1];
    const slope = back - front;                    // vol pts, long − short
    const a = Math.abs(slope);
    const strength = a < 0.4 ? 'FLAT' : a < 1.5 ? 'MILD' : a < 3 ? 'MODERATE' : 'STEEP';
    const kind = slope >= 0.4 ? 'CONTANGO' : slope <= -0.4 ? 'BACKWARDATION' : 'FLAT';
    return { slope, strength, kind };
  }, [data]);

  if (!data || !shape) {
    return <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--dim)]">Awaiting term data…</div>;
  }

  const kindColor = shape.kind === 'CONTANGO' ? 'var(--pos)' : shape.kind === 'BACKWARDATION' ? 'var(--neg)' : 'var(--dim)';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[8px] tracking-wide text-[color:var(--dim)]">
          <Swatch color={C_NOW} label="Today" />
          <Swatch color={C_YDAY} label="Yesterday" dashed muted={!data.yday} />
        </div>
        <span className="mono rounded-[3px] px-1.5 py-px text-[7.5px] font-bold tracking-wider"
          style={{ color: kindColor, background: 'rgba(255,255,255,0.05)' }}
          title="Back-tenor ATM IV minus front-tenor ATM IV">
          {shape.kind}{shape.kind !== 'FLAT' ? ` · ${shape.strength}` : ''} {shape.slope >= 0 ? '+' : ''}{shape.slope.toFixed(1)}
        </span>
      </div>

      <div ref={ref} className="relative min-h-0 flex-1">
        {width > 20 && height > 20 && (
          <Plot width={width} height={height} data={data} hover={hover} setHover={setHover} />
        )}
      </div>
      {!data.yday && (
        <div className="mt-0.5 text-[7.5px] text-[color:var(--faint)]">
          Previous-day curve appears after one trading day of recorded history.
        </div>
      )}
    </div>
  );
}

interface TermData { labels: string[]; dte: number[]; today: number[]; yday: (number | null)[] | null }

function Plot({ width, height, data, hover, setHover }: {
  width: number; height: number; data: TermData; hover: number | null; setHover: (i: number | null) => void;
}) {
  const pad = { t: 8, r: 10, b: 16, l: 28 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const n = data.today.length;
  // Even tenor spacing (categorical x) — institutional term charts don't scale by days.
  const xAt = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const all = [...data.today, ...((data.yday?.filter((v): v is number => v != null)) ?? [])];
  const yPad = (Math.max(...all) - Math.min(...all)) * 0.2 || 0.8;
  const ys = scaleLinear().domain([Math.min(...all) - yPad, Math.max(...all) + yPad]).range([h, 0]);

  const mkToday = d3line<number>().x((_, i) => xAt(i)).y((v) => ys(v)).curve(curveCatmullRom)(data.today) ?? '';
  const ydayPts = data.yday?.map((v, i) => (v != null ? ([xAt(i), ys(v)] as [number, number]) : null)).filter(Boolean) as [number, number][] | undefined;
  const mkYday = ydayPts && ydayPts.length >= 2
    ? (d3line<[number, number]>().x((d) => d[0]).y((d) => d[1]).curve(curveCatmullRom)(ydayPts) ?? '')
    : '';

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

          {mkYday && <path d={mkYday} fill="none" stroke={C_YDAY} strokeWidth={1.1} strokeDasharray="4 3" opacity={0.75} />}
          <path d={mkToday} fill="none" stroke={C_NOW} strokeWidth={1.8} strokeLinecap="round" />

          {data.today.map((v, i) => (
            <g key={i}>
              {data.yday?.[i] != null && (
                <circle cx={xAt(i)} cy={ys(data.yday[i] as number)} r={2} fill={C_YDAY} stroke="#000" strokeWidth={0.5} />
              )}
              <circle cx={xAt(i)} cy={ys(v)} r={hi === i ? 3.4 : 2.4} fill={C_NOW} stroke="#000" strokeWidth={0.6} />
              <text x={xAt(i)} y={ys(v) - 7} fontSize="7.5" fill="#c9ced6" textAnchor="middle" className="mono">{v.toFixed(1)}</text>
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
          style={{ left: Math.min(width - 120, Math.max(0, pad.l + xAt(hi) + 8)), top: 4 }}>
          <div className="mono text-[9px] font-bold text-[color:var(--text)]">{data.labels[hi]} · {Math.round(data.dte[hi])}d</div>
          <Row label="Today" value={`${data.today[hi].toFixed(2)}%`} color="var(--gold)" />
          {data.yday?.[hi] != null && (
            <>
              <Row label="Yesterday" value={`${(data.yday[hi] as number).toFixed(2)}%`} color="#8b919c" />
              <Row label="Δ 1d" value={`${data.today[hi] - (data.yday[hi] as number) >= 0 ? '+' : ''}${(data.today[hi] - (data.yday[hi] as number)).toFixed(2)}`}
                color={data.today[hi] - (data.yday[hi] as number) >= 0 ? 'var(--neg)' : 'var(--pos)'} />
            </>
          )}
        </div>
      )}
    </>
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
