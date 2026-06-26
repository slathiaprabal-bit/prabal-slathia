import { scaleLinear } from 'd3-scale';
import { motion } from 'motion/react';
import { useTerminal } from '../../store';
import { useSize } from '../../lib/useSize';

export function MonteCarloHist() {
  const mc = useTerminal((s) => s.snap?.montecarlo);
  const { ref, width, height } = useSize<HTMLDivElement>();
  const hist = mc?.hist;

  return (
    <div ref={ref} className="h-full w-full">
      {hist && width > 0 && height > 0 && (
        <Bars counts={hist.counts} edges={hist.edges} width={width} height={height} />
      )}
    </div>
  );
}

function Bars({
  counts,
  edges,
  width,
  height,
}: {
  counts: number[];
  edges: number[];
  width: number;
  height: number;
}) {
  const pad = { t: 6, r: 6, b: 16, l: 6 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const x = scaleLinear().domain([edges[0], edges[edges.length - 1]]).range([0, w]);
  const maxC = Math.max(...counts, 1);
  const y = scaleLinear().domain([0, maxC]).range([h, 0]);
  const zeroX = x(0);
  const bw = w / counts.length;

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {/* zero line */}
        <line x1={zeroX} x2={zeroX} y1={0} y2={h} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
        {counts.map((c, i) => {
          const mid = (edges[i] + edges[i + 1]) / 2;
          const up = mid >= 0;
          const bh = h - y(c);
          return (
            <motion.rect
              key={i}
              x={x(edges[i]) + 0.5}
              width={Math.max(0.5, bw - 1)}
              initial={false}
              animate={{ y: y(c), height: bh }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              rx={1}
              fill={up ? '#16f5b0' : '#ff2d6e'}
              opacity={0.82}
              style={{ filter: `drop-shadow(0 0 4px ${up ? 'rgba(22,245,176,0.5)' : 'rgba(255,45,110,0.5)'})` }}
            />
          );
        })}
        <text x={zeroX + 4} y={10} fontSize="8" fill="#5d7794">
          0%
        </text>
        <text x={w} y={h + 12} fontSize="8" fill="#5d7794" textAnchor="end">
          return over 50 trades
        </text>
      </g>
    </svg>
  );
}
