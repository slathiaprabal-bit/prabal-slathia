import { useEffect, useState } from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { useTerminal } from '../store';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { signed } from '../lib/format';

export function TopBar() {
  const snap = useTerminal((s) => s.snap);
  const conn = useTerminal((s) => s.conn);
  const [clock, setClock] = useState('');
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-IN', { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  const live = conn === 'live';
  const isError = conn === 'error';
  const badge = live
    ? { label: 'LIVE', color: '#16f5b0' }
    : isError
    ? { label: 'BACKEND ERROR', color: '#ff2d6e' }
    : { label: 'DEMO', color: '#ffb020' };
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: 'linear-gradient(135deg,#3fd6f5,#8b5cf6)', boxShadow: '0 0 18px rgba(63,214,245,0.5)' }}>
          <Activity size={16} className="text-[#05060d]" />
        </div>
        <div className="leading-none">
          <div className="text-sm font-bold tracking-wide">
            VOLARA<span className="text-[color:var(--neon)]"> · QUANT TERMINAL</span>
          </div>
          <div className="eyebrow mt-0.5">NIFTY Index Options · Volatility Desk</div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-right">
          <div className="eyebrow text-[9px]">NIFTY SPOT</div>
          <AnimatedNumber value={snap?.spot ?? 0} format={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 1 })} className="text-base font-bold text-white" />
        </div>
        <div className="text-right">
          <div className="eyebrow text-[9px]">INDIA VIX</div>
          <div className="mono text-base font-bold" style={{ color: '#ffb020' }}>
            <AnimatedNumber value={snap?.vol.vix ?? 0} format={(v) => v.toFixed(2)} />
            <span className="ml-1 text-[10px]" style={{ color: (snap?.regime.vixChg ?? 0) >= 0 ? '#ff7a8a' : '#16f5b0' }}>
              {signed(snap?.regime.vixChg, 1)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
          {live ? <Wifi size={13} style={{ color: badge.color }} /> : <WifiOff size={13} style={{ color: badge.color }} />}
          <span className="text-[10px] font-semibold tracking-wide" style={{ color: badge.color }}>
            {badge.label}
          </span>
          <span className="mono ml-1 text-[10px] text-[color:var(--dim)]">{clock}</span>
        </div>
      </div>
    </header>
  );
}
