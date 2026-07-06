import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveCatmullRom } from 'd3-shape';
import { useVolSnap } from '../../lib/vol/replay';
import { useVolSelection } from '../../lib/vol/selection';
import { useSize } from '../../lib/useSize';
import { bs } from '../../lib/adjust/bs';

// Institutional volatility smile: put wing / ATM / call wing, spot line,
// REAL historical overlays (yesterday, 5-day average — from the backend vol
// history store, never synthesized), optional richness color mapping and a
// crosshair tooltip. Overlays render only when real history exists.

const C_NOW = 'var(--gold)';
const C_YDAY = '#8b919c';
const C_AVG5 = 'var(--info)';

export function SmileChart() {
  const { snap } = useVolSnap();
  const { expiryIdx } = useVolSelection();     // surface/heatmap click syncs here
  const { ref, width, height } = useSize<HTMLDivElement>();
  const [richness, setRichness] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const surf = snap?.surface;
  const spot = snap?.spot ?? 0;
  const hist = snap?.volHistory ?? null;

  // Rendered slice: the selected expiry, else the front expiry.
  const e = expiryIdx != null && surf && expiryIdx < surf.expiries.length ? expiryIdx : 0;
  const strikes = surf?.strikes ?? snap?.smile?.strikes ?? [];
  const iv = surf?.iv?.[e] ?? snap?.smile?.iv ?? [];
  const sliceDte = surf?.expiries?.[e] ?? 7;
  // Yesterday: the full aligned grid supports any slice; 5-day avg exists for
  // the front expiry only (that's what the daily store keeps).
  const ydayRow = hist?.surfaceYesterday?.[e] ?? (e === 0 ? hist?.smileYesterday : null);
  const yday = ydayRow && ydayRow.length === iv.length ? ydayRow : null;
  const avg5 = e === 0 && hist?.smileAvg5 && hist.smileAvg5.length === iv.length ? hist.smileAvg5 : null;
  const canRich = !!avg5;

  // Skew readout: put wing (−4% moneyness) minus call wing (+4%).
  const skew = useMemo(() => {
    if (strikes.length < 3 || !spot) return null;
    const at = (m: number) => {
      const k = spot * (1 + m);
      let best = 0;
      for (let i = 1; i < strikes.length; i++) if (Math.abs(strikes[i] - k) < Math.abs(strikes[best] - k)) best = i;
      return iv[best];
    };
    return at(-0.04) - at(0.04);
  }, [strikes, iv, spot]);

  if (strikes.length < 3 || iv.length < 3) {
    return <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--dim)]">Awaiting smile data…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* legend + controls — identity is never color-alone (dash patterns differ) */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[8px] tracking-wide text-[color:var(--dim)]">
          <span className="mono rounded-[3px] px-1 py-px text-[7.5px] font-bold tracking-wider"
            style={{ color: e === 0 ? 'var(--dim)' : 'var(--gold)', background: 'rgba(255,255,255,0.05)' }}
            title="Expiry slice — click the surface or heatmap to change">
            {Math.round(sliceDte)}d{e !== 0 ? ' · SLICE' : ''}
          </span>
          <LegendSwatch color={C_NOW} label="Current" />
          <LegendSwatch color={C_YDAY} label="Yesterday" dashed muted={!yday} />
          <LegendSwatch color={C_AVG5} label="5-Day Avg" dashed muted={!avg5} />
        </div>
        <div className="flex items-center gap-1.5">
          {skew != null && (
            <span className="mono rounded-[3px] px-1 py-px text-[7.5px] font-bold tracking-wider"
              style={{ color: skew >= 0 ? 'var(--neg)' : 'var(--info)', background: 'rgba(255,255,255,0.05)' }}
              title="Put wing IV − call wing IV at ±4% moneyness">
              {skew >= 0 ? 'PUT SKEW' : 'CALL SKEW'} {Math.abs(skew).toFixed(1)}
            </span>
          )}
          <button onClick={() => canRich && setRichness((r) => !r)} disabled={!canRich}
            title={canRich ? 'Color points by IV vs 5-day average' : 'Needs ≥1 day of history'}
            className="rounded-[3px] border px-1 py-px text-[7.5px] font-bold tracking-wider disabled:opacity-30"
            style={{ borderColor: richness ? 'var(--gold)' : 'var(--line)', color: richness ? 'var(--gold)' : 'var(--dim)' }}>
            RICHNESS
          </button>
        </div>
      </div>

      <div ref={ref} className="relative min-h-0 flex-1">
        {width > 20 && height > 20 && (
          <Plot width={width} height={height} strikes={strikes} iv={iv} yday={yday} avg5={avg5}
            spot={spot} frontDte={sliceDte} richness={richness && canRich} hover={hover} setHover={setHover} />
        )}
      </div>

      {!yday && (
        <div className="mt-0.5 text-[7.5px] text-[color:var(--faint)]">
          Historical overlays appear after one trading day of recorded history — never synthesized.
        </div>
      )}
    </div>
  );
}

function Plot({ width, height, strikes, iv, yday, avg5, spot, frontDte, richness, hover, setHover }: {
  width: number; height: number; strikes: number[]; iv: number[];
  yday: number[] | null; avg5: number[] | null; spot: number; frontDte: number;
  richness: boolean; hover: number | null; setHover: (i: number | null) => void;
}) {
  const pad = { t: 8, r: 8, b: 16, l: 28 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const all = [...iv, ...(yday ?? []), ...(avg5 ?? [])];
  const xs = scaleLinear().domain([strikes[0], strikes[strikes.length - 1]]).range([0, w]);
  const yPad = (Math.max(...all) - Math.min(...all)) * 0.15 || 1;
  const ys = scaleLinear().domain([Math.min(...all) - yPad, Math.max(...all) + yPad]).range([h, 0]);
  const mk = d3line<number>().x((_, i) => xs(strikes[i])).y((v) => ys(v)).curve(curveCatmullRom);

  // ATM = strike nearest spot.
  let atmI = 0;
  for (let i = 1; i < strikes.length; i++) if (Math.abs(strikes[i] - spot) < Math.abs(strikes[atmI] - spot)) atmI = i;
  const spotX = xs(Math.max(strikes[0], Math.min(spot, strikes[strikes.length - 1])));

  // Richness color: diverging vs the 5-day average (rich = warm, cheap = cool).
  const richColor = (i: number) => {
    const d = iv[i] - (avg5?.[i] ?? iv[i]);
    if (d > 0.35) return 'var(--neg)';
    if (d < -0.35) return 'var(--info)';
    return '#8b919c';
  };

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const px = e.nativeEvent.offsetX - pad.l;
    const k = xs.invert(Math.max(0, Math.min(w, px)));
    let best = 0;
    for (let i = 1; i < strikes.length; i++) if (Math.abs(strikes[i] - k) < Math.abs(strikes[best] - k)) best = i;
    setHover(best);
  };

  const hi = hover;
  return (
    <>
      <svg width={width} height={height} className="absolute inset-0">
        <g transform={`translate(${pad.l},${pad.t})`}>
          {/* wing zones */}
          <rect x={0} y={0} width={Math.max(0, spotX)} height={h} fill="rgba(90,140,255,0.035)" />
          <rect x={spotX} y={0} width={Math.max(0, w - spotX)} height={h} fill="rgba(139,92,246,0.04)" />
          <text x={4} y={9} fontSize="7" fill="#5b616b" letterSpacing="0.1em">PUT WING</text>
          <text x={w - 4} y={9} fontSize="7" fill="#5b616b" letterSpacing="0.1em" textAnchor="end">CALL WING</text>

          {ys.ticks(3).map((t) => (
            <g key={t}>
              <line x1={0} x2={w} y1={ys(t)} y2={ys(t)} stroke="rgba(255,255,255,0.045)" />
              <text x={-5} y={ys(t) + 3} fontSize="7.5" fill="#5b616b" textAnchor="end">{t.toFixed(0)}</text>
            </g>
          ))}

          {/* historical overlays — real data only */}
          {yday && <path d={mk(yday) ?? ''} fill="none" stroke={C_YDAY} strokeWidth={1.1} strokeDasharray="4 3" opacity={0.75} />}
          {avg5 && <path d={mk(avg5) ?? ''} fill="none" stroke={C_AVG5} strokeWidth={1.1} strokeDasharray="2 3" opacity={0.75} />}

          {/* current smile */}
          <path d={mk(iv) ?? ''} fill="none" stroke={C_NOW} strokeWidth={1.8} strokeLinecap="round" />
          {strikes.map((k, i) => (i % 4 === 0 || i === atmI) && (
            <circle key={k} cx={xs(k)} cy={ys(iv[i])} r={richness ? 2.4 : 1.8}
              fill={richness ? richColor(i) : C_NOW} stroke="#000" strokeWidth={0.5} />
          ))}

          {/* spot line + ATM marker */}
          <line x1={spotX} x2={spotX} y1={12} y2={h} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 3" />
          <text x={spotX} y={9} fontSize="7" fill="#c9ced6" letterSpacing="0.1em" textAnchor="middle">ATM</text>
          <text x={spotX} y={h + 12} fontSize="7.5" fill="#c9ced6" textAnchor="middle" className="mono">
            SPOT {Math.round(spot).toLocaleString('en-IN')}
          </text>
          <path transform={`translate(${xs(strikes[atmI])},${ys(iv[atmI])})`} d="M0,-4 L4,0 L0,4 L-4,0 Z"
            fill="var(--gold)" stroke="#000" strokeWidth={0.6} />

          {/* crosshair */}
          {hi != null && (
            <>
              <line x1={xs(strikes[hi])} x2={xs(strikes[hi])} y1={0} y2={h} stroke="rgba(255,255,255,0.3)" strokeWidth={0.6} />
              <circle cx={xs(strikes[hi])} cy={ys(iv[hi])} r={3.2} fill="none" stroke={C_NOW} strokeWidth={1.2} />
            </>
          )}

          <rect x={0} y={0} width={w} height={h} fill="transparent"
            onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </g>
      </svg>

      {/* tooltip — strike · moneyness · IV · delta · Δ vs history */}
      {hi != null && (() => {
        const kind = strikes[hi] < spot ? 'P' : 'C';
        const delta = bs(spot, strikes[hi], Math.max(frontDte, 0.5) / 365, iv[hi] / 100, 0.066, kind).delta;
        return (
          <div className="pointer-events-none absolute z-10 rounded-[5px] border border-[color:var(--line)] bg-black/85 px-2 py-1.5"
            style={{ left: Math.min(width - 130, Math.max(0, pad.l + xs(strikes[hi]) + 8)), top: 6 }}>
            <div className="mono text-[9px] font-bold text-[color:var(--text)]">
              {strikes[hi].toLocaleString('en-IN')}
              <span className="ml-1 text-[color:var(--faint)]">({((strikes[hi] / spot - 1) * 100).toFixed(1)}%)</span>
            </div>
            <Row label="IV" value={`${iv[hi].toFixed(2)}%`} color="var(--gold)" />
            <Row label={`${kind === 'P' ? 'Put' : 'Call'} delta`} value={delta.toFixed(2)} color="var(--text)" />
            {yday && <Row label="Δ vs yday" value={`${iv[hi] - yday[hi] >= 0 ? '+' : ''}${(iv[hi] - yday[hi]).toFixed(2)}`}
              color={iv[hi] - yday[hi] >= 0 ? 'var(--neg)' : 'var(--pos)'} />}
            {avg5 && <Row label="Δ vs 5d avg" value={`${iv[hi] - avg5[hi] >= 0 ? '+' : ''}${(iv[hi] - avg5[hi]).toFixed(2)}`}
              color={iv[hi] - avg5[hi] >= 0 ? 'var(--neg)' : 'var(--pos)'} />}
          </div>
        );
      })()}
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

function LegendSwatch({ color, label, dashed, muted }: { color: string; label: string; dashed?: boolean; muted?: boolean }) {
  return (
    <span className="flex items-center gap-1" style={{ opacity: muted ? 0.35 : 1 }}>
      <span className="inline-block h-[2px] w-3.5"
        style={{ background: dashed ? `repeating-linear-gradient(90deg,${color} 0 3px,transparent 3px 5px)` : color }} />
      {label}
    </span>
  );
}
