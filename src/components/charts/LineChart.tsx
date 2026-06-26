import { scaleLinear } from 'd3-scale';
import { line as d3line, area as d3area, curveCatmullRom } from 'd3-shape';
import { motion } from 'motion/react';
import { useSize } from '../../lib/useSize';

interface Props {
  x: number[];
  y: number[];
  color?: string;
  marker?: number; // x-value to highlight (e.g. spot / ATM)
  yLabel?: string;
  xLabel?: string;
}

// Reusable animated neon line chart (smile, term structure, history...).
export function LineChart({ x, y, color = '#3fd6f5', marker, yLabel, xLabel }: Props) {
  const { ref, width, height } = useSize<HTMLDivElement>();
  return (
    <div ref={ref} className="h-full w-full">
      {width > 0 && height > 0 && x.length > 1 && (
        <Inner x={x} y={y} width={width} height={height} color={color} marker={marker} yLabel={yLabel} xLabel={xLabel} />
      )}
    </div>
  );
}

function Inner({
  x,
  y,
  width,
  height,
  color,
  marker,
  yLabel,
  xLabel,
}: Props & { width: number; height: number }) {
  const pad = { t: 8, r: 10, b: 16, l: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const xs = scaleLinear().domain([Math.min(...x), Math.max(...x)]).range([0, w]);
  const yMin = Math.min(...y);
  const yMax = Math.max(...y);
  const pad2 = (yMax - yMin) * 0.15 || 1;
  const ys = scaleLinear().domain([yMin - pad2, yMax + pad2]).range([h, 0]);

  const pts: [number, number][] = x.map((xi, i) => [xs(xi), ys(y[i])]);
  const linePath = d3line<[number, number]>().x((d) => d[0]).y((d) => d[1]).curve(curveCatmullRom)(pts) ?? '';
  const areaPath =
    d3area<[number, number]>().x((d) => d[0]).y0(h).y1((d) => d[1]).curve(curveCatmullRom)(pts) ?? '';

  const gid = `g-${(color || '').replace('#', '')}`;
  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {ys.ticks(3).map((t) => (
          <g key={t}>
            <line x1={0} x2={w} y1={ys(t)} y2={ys(t)} stroke="rgba(255,255,255,0.05)" />
            <text x={-4} y={ys(t) + 3} fontSize="8" fill="#5d7794" textAnchor="end">
              {t.toFixed(0)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill={`url(#${gid})`} />
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
        {marker !== undefined && marker >= Math.min(...x) && marker <= Math.max(...x) && (
          <line x1={xs(marker)} x2={xs(marker)} y1={0} y2={h} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
        )}
        {yLabel && (
          <text x={0} y={-1} fontSize="8" fill="#5d7794">
            {yLabel}
          </text>
        )}
        {xLabel && (
          <text x={w} y={h + 13} fontSize="8" fill="#5d7794" textAnchor="end">
            {xLabel}
          </text>
        )}
      </g>
    </svg>
  );
}
