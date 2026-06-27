import { scaleLinear } from 'd3-scale';
import { line as d3line, area as d3area, curveCatmullRom } from 'd3-shape';
import { motion } from 'motion/react';
import { useSize } from '../../lib/useSize';

interface Ghost {
  y: number[];
  color: string;
  dash?: string;
}

interface Props {
  x: number[];
  y: number[];
  color?: string;
  marker?: number; // x-value to highlight (e.g. spot / ATM)
  yLabel?: string;
  xLabel?: string;
  ghosts?: Ghost[]; // faint comparison curves (e.g. week / month ago)
  dots?: boolean;
  pointLabels?: (v: number) => string; // value labels above each point
}

// Reusable elegant line chart — thin stroke, subtle gradient fill, clean axes.
export function LineChart({ x, y, color = '#27d17c', marker, yLabel, xLabel, ghosts, dots, pointLabels }: Props) {
  const { ref, width, height } = useSize<HTMLDivElement>();
  return (
    <div ref={ref} className="h-full w-full">
      {width > 0 && height > 0 && x.length > 1 && (
        <Inner x={x} y={y} width={width} height={height} color={color} marker={marker} yLabel={yLabel} xLabel={xLabel} ghosts={ghosts} dots={dots} pointLabels={pointLabels} />
      )}
    </div>
  );
}

function Inner({
  x, y, width, height, color, marker, yLabel, xLabel, ghosts, dots, pointLabels,
}: Props & { width: number; height: number }) {
  const pad = { t: 10, r: 12, b: 18, l: 30 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const allY = [...y, ...(ghosts?.flatMap((g) => g.y) ?? [])];
  const xs = scaleLinear().domain([Math.min(...x), Math.max(...x)]).range([0, w]);
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);
  const padY = (yMax - yMin) * 0.18 || 1;
  const ys = scaleLinear().domain([yMin - padY, yMax + padY]).range([h, 0]);

  const toPts = (yy: number[]): [number, number][] => x.map((xi, i) => [xs(xi), ys(yy[i])]);
  const pts = toPts(y);
  const mk = d3line<[number, number]>().x((d) => d[0]).y((d) => d[1]).curve(curveCatmullRom);
  const linePath = mk(pts) ?? '';
  const areaPath = d3area<[number, number]>().x((d) => d[0]).y0(h).y1((d) => d[1]).curve(curveCatmullRom)(pts) ?? '';

  const gid = `g-${(color || '').replace('#', '')}`;
  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.16} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {ys.ticks(3).map((t) => (
          <g key={t}>
            <line x1={0} x2={w} y1={ys(t)} y2={ys(t)} stroke="rgba(255,255,255,0.045)" />
            <text x={-6} y={ys(t) + 3} fontSize="8" fill="#5b616b" textAnchor="end">{t.toFixed(0)}</text>
          </g>
        ))}

        {/* comparison ghosts */}
        {ghosts?.map((g, i) => (
          <path key={i} d={mk(toPts(g.y)) ?? ''} fill="none" stroke={g.color} strokeWidth={1.25} strokeDasharray={g.dash ?? '3 3'} opacity={0.6} />
        ))}

        <path d={areaPath} fill={`url(#${gid})`} />
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        {dots && pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={2.2} fill={color} stroke="#000" strokeWidth={0.5} />
        ))}
        {pointLabels && pts.map((p, i) => {
          const stride = Math.max(1, Math.ceil(pts.length / 6));
          if (i % stride !== 0 && i !== pts.length - 1) return null;
          return (
            <text key={`l${i}`} x={p[0]} y={p[1] - 7} fontSize="8" fill="#c9ced6" textAnchor="middle" className="mono">
              {pointLabels(y[i])}
            </text>
          );
        })}
        {marker !== undefined && marker >= Math.min(...x) && marker <= Math.max(...x) && (
          <line x1={xs(marker)} x2={xs(marker)} y1={0} y2={h} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
        )}
        {yLabel && <text x={0} y={-2} fontSize="8" fill="#5b616b">{yLabel}</text>}
        {xLabel && <text x={w} y={h + 14} fontSize="8" fill="#5b616b" textAnchor="end">{xLabel}</text>}
      </g>
    </svg>
  );
}
