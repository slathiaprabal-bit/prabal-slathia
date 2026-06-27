import { motion } from 'motion/react';

interface Props {
  value: number; // 0..1
  label: string;
  display: string;
  color?: string;
  size?: number;
}

// Radial arc gauge (270° sweep). GPU-friendly SVG, animated stroke.
export function Gauge({ value, label, display, color = '#3fd6f5', size = 96 }: Props) {
  const v = Math.max(0, Math.min(1, value));
  const r = size / 2 - 9;
  const cx = size / 2;
  const cy = size / 2;
  const start = 135;
  const sweep = 270;
  const circ = 2 * Math.PI * r;
  const arcFrac = sweep / 360;
  const dash = circ * arcFrac;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-[0deg]">
        <g transform={`rotate(${start} ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            initial={false}
            animate={{ strokeDashoffset: dash * (1 - v) }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </g>
        <text x={cx} y={cy - 1} textAnchor="middle" className="mono" fontSize="15" fontWeight={700} fill={color}>
          {display}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8" fill="#8a909a" letterSpacing="1.5">
          {label}
        </text>
      </svg>
    </div>
  );
}
