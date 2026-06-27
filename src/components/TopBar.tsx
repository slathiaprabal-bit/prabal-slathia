import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useTerminal } from '../store';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { signed } from '../lib/format';
import { WORKSPACE_MAP } from '../workspaces/registry';

export function TopBar() {
  const snap = useTerminal((s) => s.snap);
  const conn = useTerminal((s) => s.conn);
  const workspace = useTerminal((s) => s.workspace);
  const ws = WORKSPACE_MAP[workspace];
  const [clock, setClock] = useState('');
  useEffect(() => {
    const t = setInterval(
      () => setClock(new Date().toLocaleTimeString('en-IN', { hour12: false })),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  const live = conn === 'live';
  const isError = conn === 'error';
  const badge = live
    ? { label: 'LIVE', color: '#16f5b0' }
    : isError
    ? { label: 'ERROR', color: '#ff2d6e' }
    : { label: 'DEMO', color: '#ffb020' };

  const ivr = snap?.vol.ivRank ?? 0;
  const ivrColor = ivr >= 70 ? '#ff2d6e' : ivr >= 50 ? '#ffb020' : '#16f5b0';

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
      {/* Brand */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="text-sm font-black tracking-widest text-white">
            VOLARA
            <span className="text-[color:var(--neon)]"> QUANT</span>
          </div>
          <div className="rounded bg-[#3fd6f5]/10 border border-[#3fd6f5]/20 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-[#3fd6f5]">
            V3
          </div>
        </div>
        <div className="h-4 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ws.accent, boxShadow: `0 0 8px ${ws.accent}` }} />
          <span className="text-[11px] font-bold tracking-wide text-[color:var(--text)]">{ws.label}</span>
        </div>
      </div>

      {/* Live metrics strip */}
      <div className="flex items-center gap-4">
        {/* Spot */}
        <div className="text-right">
          <div className="eyebrow text-[8px]">NIFTY SPOT</div>
          <AnimatedNumber
            value={snap?.spot ?? 0}
            format={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
            className="mono text-base font-bold text-white"
          />
        </div>

        <div className="h-6 w-px bg-white/[0.06]" />

        {/* VIX */}
        <div className="text-right">
          <div className="eyebrow text-[8px]">INDIA VIX</div>
          <div className="mono text-base font-bold" style={{ color: '#ffb020' }}>
            <AnimatedNumber value={snap?.vol.vix ?? 0} format={(v) => v.toFixed(2)} />
            <span className="ml-1 text-[10px]"
              style={{ color: (snap?.regime.vixChg ?? 0) >= 0 ? '#ff7a8a' : '#16f5b0' }}>
              {signed(snap?.regime.vixChg, 1)}%
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-white/[0.06]" />

        {/* IV Rank */}
        <div className="text-right">
          <div className="eyebrow text-[8px]">IV RANK</div>
          <div className="mono text-base font-bold" style={{ color: ivrColor }}>
            <AnimatedNumber value={ivr} format={(v) => `${v.toFixed(0)}`} />
          </div>
        </div>

        <div className="h-6 w-px bg-white/[0.06]" />

        {/* Regime */}
        <div className="text-right">
          <div className="eyebrow text-[8px]">REGIME</div>
          <div className="text-xs font-bold text-white">{snap?.regime.state?.replace('_', ' ') ?? '—'}</div>
        </div>

        <div className="h-6 w-px bg-white/[0.06]" />

        {/* Connection badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1">
          {live ? <Wifi size={12} style={{ color: badge.color }} /> : <WifiOff size={12} style={{ color: badge.color }} />}
          <span className="text-[9px] font-bold tracking-widest" style={{ color: badge.color }}>
            {badge.label}
          </span>
          <span className="mono ml-1 text-[9px] text-[color:var(--dim)]">{clock}</span>
        </div>
      </div>
    </header>
  );
}
