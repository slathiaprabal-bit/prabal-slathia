import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useTerminal } from '../../store';
import { AnimatedNumber } from '../ui/AnimatedNumber';

interface MacroTick {
  usdinr: number;
  us10y: number;
  dxy: number;
  crude: number;
  gold: number;
  fii: number;  // FII net (Cr)
  dii: number;  // DII net (Cr)
  advance: number;
  decline: number;
}

function noise(seed: number, amp: number) {
  return Math.sin(seed * 1.31 + seed * 0.77) * amp;
}

function makeTick(t: number): MacroTick {
  return {
    usdinr: 83.42 + Math.sin(t * 0.18) * 0.35 + noise(t, 0.08),
    us10y:  4.28 + Math.sin(t * 0.12) * 0.15 + noise(t, 0.04),
    dxy:    104.6 + Math.sin(t * 0.14) * 0.8 + noise(t, 0.2),
    crude:  78.4 + Math.sin(t * 0.22) * 2.2 + noise(t, 0.5),
    gold:   2318 + Math.sin(t * 0.15) * 18 + noise(t, 4),
    fii:    -(820 + Math.sin(t * 0.3) * 650 + noise(t, 100)),
    dii:    1240 + Math.sin(t * 0.25) * 480 + noise(t, 80),
    advance: Math.round(980 + Math.sin(t * 0.4) * 220),
    decline: Math.round(580 + Math.cos(t * 0.4) * 180),
  };
}

interface MacroItem {
  label: string;
  value: React.ReactNode;
  change?: React.ReactNode;
  color?: string;
}

export function MacroPanel() {
  const [tick, setTick] = useState(0);
  const [mac, setMac] = useState<MacroTick>(makeTick(0));
  const vix = useTerminal((s) => s.snap?.vol.vix ?? 0);
  const vixChg = useTerminal((s) => s.snap?.regime.vixChg ?? 0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => {
        const nt = t + 1;
        setMac(makeTick(nt * 0.08));
        return nt;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const items: MacroItem[] = [
    {
      label: 'USD/INR',
      value: <AnimatedNumber value={mac.usdinr} format={(v) => v.toFixed(2)} />,
      change: <span style={{ color: mac.usdinr > 83.42 ? '#ff7a8a' : '#16f5b0' }}>
        {(mac.usdinr - 83.42 >= 0 ? '+' : '') + (mac.usdinr - 83.42).toFixed(2)}
      </span>,
      color: '#ffb020',
    },
    {
      label: 'INDIA VIX',
      value: <AnimatedNumber value={vix} format={(v) => v.toFixed(2)} />,
      change: <span style={{ color: vixChg >= 0 ? '#ff7a8a' : '#16f5b0' }}>
        {(vixChg >= 0 ? '+' : '') + vixChg.toFixed(1)}%
      </span>,
      color: '#ffb020',
    },
    {
      label: 'US 10Y YIELD',
      value: <AnimatedNumber value={mac.us10y} format={(v) => `${v.toFixed(2)}%`} />,
      change: <span style={{ color: mac.us10y > 4.28 ? '#ff7a8a' : '#16f5b0' }}>
        {(mac.us10y - 4.28 >= 0 ? '+' : '') + (mac.us10y - 4.28).toFixed(2)}
      </span>,
      color: '#c084fc',
    },
    {
      label: 'DXY',
      value: <AnimatedNumber value={mac.dxy} format={(v) => v.toFixed(1)} />,
      change: <span style={{ color: mac.dxy > 104.6 ? '#ff7a8a' : '#16f5b0' }}>
        {(mac.dxy - 104.6 >= 0 ? '+' : '') + (mac.dxy - 104.6).toFixed(1)}
      </span>,
      color: '#3fd6f5',
    },
    {
      label: 'CRUDE (USD)',
      value: <AnimatedNumber value={mac.crude} format={(v) => `$${v.toFixed(1)}`} />,
      change: <span style={{ color: mac.crude > 78.4 ? '#ff7a8a' : '#16f5b0' }}>
        {(mac.crude - 78.4 >= 0 ? '+' : '') + (mac.crude - 78.4).toFixed(1)}
      </span>,
      color: '#ff7a59',
    },
    {
      label: 'GOLD (USD)',
      value: <AnimatedNumber value={mac.gold} format={(v) => `$${v.toFixed(0)}`} />,
      change: <span style={{ color: mac.gold > 2318 ? '#16f5b0' : '#ff7a8a' }}>
        {(mac.gold - 2318 >= 0 ? '+' : '') + (mac.gold - 2318).toFixed(0)}
      </span>,
      color: '#ffe000',
    },
  ];

  const fiiColor = mac.fii >= 0 ? '#16f5b0' : '#ff7a8a';
  const diiColor = mac.dii >= 0 ? '#16f5b0' : '#ff7a8a';
  const advRatio = mac.advance / (mac.advance + mac.decline);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      {/* Macro grid */}
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ label, value, change, color }) => (
          <div
            key={label}
            className="rounded-[6px] border border-white/5 bg-white/[0.02] p-2.5"
          >
            <div className="eyebrow text-[8px] mb-1">{label}</div>
            <div className="mono text-sm font-bold" style={{ color }}>
              {value}
            </div>
            <div className="text-[10px] mt-0.5">{change}</div>
          </div>
        ))}
      </div>

      {/* FII / DII flow */}
      <div className="rounded-[6px] border border-white/5 bg-white/[0.02] p-3">
        <div className="eyebrow text-[9px] mb-2">INSTITUTIONAL FLOW (₹ Cr)</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="eyebrow text-[8px] text-[color:var(--dim)]">FII NET</div>
            <div className="mono text-sm font-bold" style={{ color: fiiColor }}>
              <AnimatedNumber
                value={mac.fii}
                format={(v) => `${v >= 0 ? '+' : ''}${(v / 100).toFixed(0)}Cr`}
              />
            </div>
          </div>
          <div>
            <div className="eyebrow text-[8px] text-[color:var(--dim)]">DII NET</div>
            <div className="mono text-sm font-bold" style={{ color: diiColor }}>
              <AnimatedNumber
                value={mac.dii}
                format={(v) => `${v >= 0 ? '+' : ''}${(v / 100).toFixed(0)}Cr`}
              />
            </div>
          </div>
        </div>
        {/* Flow bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #ff2d6e, #16f5b0)',
              width: `${Math.abs(mac.fii) / (Math.abs(mac.fii) + mac.dii) * 100}%`,
            }}
            animate={{ width: `${Math.abs(mac.fii) / (Math.abs(mac.fii) + mac.dii) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-[color:var(--dim)]">
          <span style={{ color: fiiColor }}>FII {mac.fii < 0 ? 'Sell' : 'Buy'}</span>
          <span style={{ color: diiColor }}>DII {mac.dii >= 0 ? 'Buy' : 'Sell'}</span>
        </div>
      </div>

      {/* Market breadth */}
      <div className="rounded-[6px] border border-white/5 bg-white/[0.02] p-3">
        <div className="eyebrow text-[9px] mb-2">MARKET BREADTH</div>
        <div className="flex items-center gap-3">
          <div>
            <div className="mono text-base font-bold text-[#16f5b0]">
              <AnimatedNumber value={mac.advance} format={(v) => v.toFixed(0)} />
            </div>
            <div className="text-[9px] text-[color:var(--dim)]">Advances</div>
          </div>
          <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/[0.05]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#16f5b0] to-[#ff2d6e]"
              style={{ width: `${advRatio * 100}%` }}
              animate={{ width: `${advRatio * 100}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <div>
            <div className="mono text-base font-bold text-[#ff7a8a]">
              <AnimatedNumber value={mac.decline} format={(v) => v.toFixed(0)} />
            </div>
            <div className="text-[9px] text-[color:var(--dim)]">Declines</div>
          </div>
        </div>
        <div className="mt-1 text-center text-[10px]"
          style={{ color: advRatio > 0.55 ? '#16f5b0' : advRatio < 0.45 ? '#ff7a8a' : 'var(--dim)' }}>
          A/D Ratio: {(mac.advance / mac.decline).toFixed(2)}
          {advRatio > 0.55 ? ' — Broad strength' : advRatio < 0.45 ? ' — Broad weakness' : ' — Mixed'}
        </div>
      </div>
    </div>
  );
}
