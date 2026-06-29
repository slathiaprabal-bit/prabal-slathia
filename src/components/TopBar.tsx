import { useEffect, useState } from 'react';
import { Bell, Settings as SettingsIcon, User, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTerminal } from '../store';
import { AnimatedNumber } from './ui/AnimatedNumber';

export function TopBar() {
  const snap = useTerminal((s) => s.snap);
  const conn = useTerminal((s) => s.conn);
  const setWorkspace = useTerminal((s) => s.setWorkspace);
  const [clock, setClock] = useState('');
  useEffect(() => {
    const t = setInterval(
      () => setClock(new Date().toLocaleTimeString('en-IN', { hour12: true })),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  const live = conn === 'live';
  const isError = conn === 'error';
  const dot = live ? 'var(--pos)' : isError ? 'var(--neg)' : 'var(--gold)';
  const connLabel = live ? 'LIVE' : isError ? 'ERROR' : 'DEMO';

  const spot = snap?.spot ?? 0;
  const bnf = snap?.secondary?.banknifty;
  const vix = snap?.vol.vix ?? 0;
  const vixChg = snap?.regime.vixChg ?? 0;
  const ivr = snap?.vol.ivRank ?? 0;
  const ivrTag = ivr >= 70 ? 'High' : ivr >= 45 ? 'Moderate' : 'Low';
  const ivrColor = ivr >= 70 ? 'var(--neg)' : ivr >= 45 ? 'var(--gold)' : 'var(--pos)';
  const regime = snap?.regime.state ?? 'NORMAL';
  const regUp = regime === 'TRENDING_UP';
  const regDown = regime === 'TRENDING_DOWN' || regime === 'NO_GO';
  const RegIcon = regUp ? TrendingUp : regDown ? TrendingDown : Minus;
  const regColor = regUp ? 'var(--pos)' : regDown ? 'var(--neg)' : 'var(--gold)';

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[color:var(--line)] bg-[color:var(--bg1)] px-3.5">
      {/* Brand */}
      <div className="flex items-center gap-5">
        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-black tracking-tight text-white">VOLARA</span>
          <span className="flex flex-col leading-none">
            <span className="text-[8px] font-semibold tracking-[0.34em] text-[color:var(--dim)]">QUANT TERMINAL</span>
          </span>
          <span className="ml-0.5 rounded-[4px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-[color:var(--gold)]">
            V3.0
          </span>
        </div>

        <div className="h-7 w-px bg-[color:var(--line)]" />

        {/* Multi-index strip */}
        <div className="flex items-center gap-5">
          <Quote label="NIFTY" value={spot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} chg={-0.42} live animated valueNode={
            <AnimatedNumber value={spot} format={(v) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} className="mono text-[15px] font-bold text-white" />
          } />
          <Quote
            label="BANKNIFTY"
            value={bnf?.value != null
              ? bnf.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '—'}
            chg={bnf?.chg ?? 0}
          />
          <div className="flex flex-col">
            <span className="eyebrow text-[8px]">INDIA VIX</span>
            <span className="flex items-baseline gap-1.5">
              <AnimatedNumber value={vix} format={(v) => v.toFixed(2)} className="mono text-[15px] font-bold text-white" />
              <span className="mono text-[10px]" style={{ color: vixChg >= 0 ? 'var(--neg)' : 'var(--pos)' }}>
                {vixChg >= 0 ? '+' : ''}{vixChg.toFixed(2)}%
              </span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="eyebrow text-[8px]">IV RANK</span>
            <span className="flex items-baseline gap-1.5">
              <AnimatedNumber value={ivr} format={(v) => v.toFixed(0)} className="mono text-[15px] font-bold text-white" />
              <span className="text-[10px] font-semibold" style={{ color: ivrColor }}>{ivrTag}</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="eyebrow text-[8px]">MARKET REGIME</span>
            <span className="flex items-center gap-1.5" style={{ color: regColor }}>
              <RegIcon size={14} strokeWidth={2.2} />
              <span className="text-[12px] font-bold tracking-tight">{regime.replace(/_/g, ' ')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Status + controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-[6px] border border-[color:var(--line)] bg-[color:var(--bg2)] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full pulse" style={{ background: dot }} />
          <span className="text-[10px] font-bold tracking-widest" style={{ color: dot }}>{connLabel}</span>
          <span className="mono ml-1 text-[10px] text-[color:var(--dim)]">{clock}</span>
        </div>
        <IconBtn><Bell size={15} /></IconBtn>
        <IconBtn onClick={() => setWorkspace('settings')}><SettingsIcon size={15} /></IconBtn>
        <IconBtn><User size={15} /></IconBtn>
      </div>
    </header>
  );
}

function Quote({ label, value, chg, valueNode }: { label: string; value: string; chg: number; live?: boolean; animated?: boolean; valueNode?: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="eyebrow text-[8px]">{label}</span>
      <span className="flex items-baseline gap-1.5">
        {valueNode ?? <span className="mono text-[15px] font-bold text-white">{value}</span>}
        <span className="mono text-[10px]" style={{ color: chg >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
          {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
        </span>
      </span>
    </div>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="nav-item flex h-8 w-8 items-center justify-center text-[color:var(--dim)] hover:text-[color:var(--text)]"
    >
      {children}
    </button>
  );
}
