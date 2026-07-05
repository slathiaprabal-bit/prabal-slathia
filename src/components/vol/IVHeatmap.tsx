import { useState } from 'react';
import { useTerminal } from '../../store';
import { useSize } from '../../lib/useSize';
import { IV_STOPS } from '../../theme';
import { sampleScale } from '../../lib/format';

const IV_LO = 8, IV_HI = 42; // same scale domain as the 3D surface / legend

// 2D strike × expiry IV heatmap — the same data and color scale as the 3D
// surface, readable at a glance. Hover shows strike, expiry, IV and the real
// 1-day IV change where history exists.
export function IVHeatmap() {
  const surf = useTerminal((s) => s.snap?.surface);
  const spot = useTerminal((s) => s.snap?.spot ?? 0);
  const ydayGrid = useTerminal((s) => s.snap?.volHistory?.surfaceYesterday ?? null);
  const { ref, width, height } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);

  if (!surf) return null;
  const { strikes, expiries, iv } = surf;
  const nx = strikes.length, ny = expiries.length;

  const pad = { t: 8, r: 10, b: 20, l: 34 };
  const w = Math.max(0, width - pad.l - pad.r), h = Math.max(0, height - pad.t - pad.b);
  const cw = w / nx, ch = h / ny;

  // ATM column for the spot marker.
  let atmI = 0;
  for (let i = 1; i < nx; i++) if (Math.abs(strikes[i] - spot) < Math.abs(strikes[atmI] - spot)) atmI = i;

  const dYday = hover && ydayGrid?.[hover.j]?.[hover.i] != null
    ? iv[hover.j][hover.i] - ydayGrid[hover.j][hover.i] : null;

  return (
    <div ref={ref} className="absolute inset-0">
      {width > 40 && height > 40 && (
        <>
          <svg width={width} height={height}>
            <g transform={`translate(${pad.l},${pad.t})`}>
              {iv.map((row, j) => row.map((v, i) => {
                const t = Math.max(0, Math.min(1, (v - IV_LO) / (IV_HI - IV_LO)));
                const isHover = hover?.i === i && hover?.j === j;
                return (
                  <rect key={`${i}-${j}`} x={i * cw} y={h - (j + 1) * ch} width={cw + 0.5} height={ch + 0.5}
                    fill={sampleScale(IV_STOPS, t)} opacity={isHover ? 1 : 0.92}
                    stroke={isHover ? '#fff' : 'none'} strokeWidth={isHover ? 1 : 0}
                    onMouseEnter={() => setHover({ i, j })} onMouseLeave={() => setHover(null)} />
                );
              }))}
              {/* spot column marker */}
              <line x1={(atmI + 0.5) * cw} x2={(atmI + 0.5) * cw} y1={0} y2={h} stroke="rgba(255,255,255,0.55)" strokeDasharray="3 3" strokeWidth={0.8} />
              <text x={(atmI + 0.5) * cw} y={h + 13} fontSize="7.5" fill="#c9ced6" textAnchor="middle" className="mono">
                SPOT {Math.round(spot).toLocaleString('en-IN')}
              </text>
              {/* axes: a few strike ticks + every expiry row */}
              {[0, Math.floor(nx / 2), nx - 1].map((i) => (
                <text key={i} x={(i + 0.5) * cw} y={h + 13} fontSize="7" fill="#5b616b"
                  textAnchor={i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle'} className="mono"
                  opacity={Math.abs(i - atmI) < nx * 0.12 ? 0 : 1}>
                  {Math.round(strikes[i] / 100) * 100}
                </text>
              ))}
              {expiries.map((d, j) => (
                <text key={j} x={-5} y={h - (j + 0.5) * ch + 3} fontSize="7" fill="#5b616b" textAnchor="end" className="mono">
                  {Math.round(d)}d
                </text>
              ))}
            </g>
          </svg>

          {hover && (
            <div className="pointer-events-none absolute z-10 rounded-[5px] border border-[color:var(--line)] bg-black/85 px-2 py-1.5"
              style={{
                left: Math.min(width - 140, Math.max(0, pad.l + (hover.i + 0.5) * cw + 10)),
                top: Math.max(2, pad.t + h - (hover.j + 0.5) * ch - 46),
              }}>
              <div className="mono text-[9px] font-bold text-[color:var(--text)]">
                {strikes[hover.i].toLocaleString('en-IN')} · {Math.round(expiries[hover.j])}d
              </div>
              <div className="flex items-center justify-between gap-3 text-[8px]">
                <span className="text-[color:var(--dim)]">IV</span>
                <span className="mono font-semibold text-[color:var(--gold)]">{iv[hover.j][hover.i].toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[8px]">
                <span className="text-[color:var(--dim)]">Δ 1d</span>
                <span className="mono font-semibold" style={{ color: dYday == null ? 'var(--faint)' : dYday >= 0 ? 'var(--neg)' : 'var(--pos)' }}>
                  {dYday == null ? 'no history' : `${dYday >= 0 ? '+' : ''}${dYday.toFixed(2)}`}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
