import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { ChevronDown, Zap, TrendingUp, TrendingDown, Minus, Shield, AlertTriangle } from 'lucide-react';
import { useTerminal } from '../../store';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import type { StrategyCandidate } from '../../types';

const RISK_COLOR: Record<string, string> = {
  LOW: '#27d17c',
  MEDIUM: '#5aa9ff',
  HIGH: '#f4b740',
  VERY_HIGH: '#f04668',
};

const CAT_COLOR: Record<string, string> = {
  theta: '#5aa9ff',
  directional: '#c79bff',
  volatility: '#f4b740',
  calendar: '#c79bff',
  institutional: '#f4b740',
  event: '#f04668',
  nifty: '#27d17c',
};

function DirectionalIcon({ d }: { d: string }) {
  if (d === 'bull') return <TrendingUp size={11} className="text-[#27d17c]" />;
  if (d === 'bear') return <TrendingDown size={11} className="text-[#f04668]" />;
  return <Minus size={11} className="text-[color:var(--dim)]" />;
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const color =
    score >= 70 ? '#27d17c'
    : score >= 50 ? '#5aa9ff'
    : score >= 35 ? '#f4b740'
    : '#f04668';
  return (
    <svg width={44} height={44} className="shrink-0">
      <circle cx={22} cy={22} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <motion.circle
        cx={22} cy={22} r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - score / 100) }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        transform="rotate(-90 22 22)"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text x={22} y={26} textAnchor="middle" fontSize={11} fontWeight={700} fill={color}>
        {score}
      </text>
    </svg>
  );
}

function StrategyCard({ s, rank, defaultOpen }: { s: StrategyCandidate; rank: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const catColor = CAT_COLOR[s.category] ?? '#5aa9ff';
  const riskColor = RISK_COLOR[s.risk] ?? '#f4b740';
  const evPositive = s.ev >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
      className="rounded-[6px] border border-white/6 bg-white/[0.025] overflow-hidden"
      style={{ borderColor: rank === 1 ? `${catColor}28` : 'rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-2.5 p-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {/* Rank badge */}
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-black"
          style={{
            background: rank === 1 ? `linear-gradient(135deg,${catColor}40,${catColor}18)` : 'rgba(255,255,255,0.04)',
            color: rank === 1 ? catColor : 'var(--dim)',
            border: `1px solid ${rank === 1 ? catColor + '40' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          #{rank}
        </div>

        <ScoreRing score={s.score} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-bold text-white truncate">{s.name}</span>
            <DirectionalIcon d={s.directional} />
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-[4px] px-1.5 py-0.5 text-[8px] font-semibold tracking-wider"
              style={{ background: `${catColor}18`, color: catColor }}
            >
              {s.category.toUpperCase()}
            </span>
            <span
              className="rounded-[4px] px-1.5 py-0.5 text-[8px] font-semibold tracking-wider"
              style={{ background: `${riskColor}18`, color: riskColor }}
            >
              {s.risk.replace('_', ' ')} RISK
            </span>
          </div>
        </div>

        {/* EV */}
        <div className="text-right shrink-0">
          <div className="eyebrow text-[8px]">EV/LOT</div>
          <div className="mono text-sm font-bold" style={{ color: evPositive ? '#27d17c' : '#f04668' }}>
            {evPositive ? '+' : ''}
            <AnimatedNumber value={s.ev} format={(v) => `₹${Math.abs(v).toFixed(0)}`} />
          </div>
        </div>

        <ChevronDown
          size={14}
          className="shrink-0 text-[color:var(--dim)] transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 flex flex-col gap-2.5 border-t border-white/[0.05]">
              {/* Key metrics grid */}
              <div className="grid grid-cols-3 gap-2 pt-2.5">
                {[
                  { l: 'POP', v: `${s.pop.toFixed(0)}%`, c: '#5aa9ff' },
                  { l: 'MAX GAIN', v: `₹${(s.maxGain / 1000).toFixed(1)}k`, c: '#27d17c' },
                  { l: 'MAX LOSS', v: `₹${(s.maxLoss / 1000).toFixed(1)}k`, c: '#f04668' },
                  { l: 'CONFIDENCE', v: `${s.confidence.toFixed(0)}%`, c: '#c79bff' },
                  { l: 'R:R RATIO', v: s.rrRatio.toFixed(2), c: '#f4b740' },
                  { l: 'CATEGORY', v: s.category.slice(0,6).toUpperCase(), c: catColor },
                ].map(({ l, v, c }) => (
                  <div key={l} className="cell px-2 py-1.5">
                    <div className="eyebrow text-[8px] mb-0.5">{l}</div>
                    <div className="mono text-xs font-bold" style={{ color: c }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* POP confidence bar */}
              <div>
                <div className="flex justify-between text-[9px] mb-1">
                  <span className="eyebrow">PROBABILITY OF PROFIT</span>
                  <span className="mono text-[#5aa9ff] font-semibold">{s.pop.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#c79bff,#5aa9ff,#27d17c)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pop}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Reasoning */}
              {s.reasoning.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="eyebrow text-[9px] mb-0.5">SIGNAL REASONING</div>
                  {s.reasoning.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-[color:var(--dim)]">
                      <Zap size={9} className="shrink-0 mt-0.5" style={{ color: catColor }} />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AIDecisionPanel() {
  const strategies = useTerminal((s) => s.snap?.strategies);
  const trade = useTerminal((s) => s.snap?.trade);

  if (!strategies) return (
    <div className="flex h-full items-center justify-center text-[color:var(--dim)] text-xs">
      Scoring strategies…
    </div>
  );

  const { top3, totalScored, marketCondition } = strategies;
  const decision = trade?.decision ?? 'NO_TRADE';

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      {/* Market condition banner */}
      <div className="cell px-3 py-2">
        <div className="eyebrow text-[8px] mb-1">MARKET CONDITION · {totalScored} STRATEGIES SCORED</div>
        <div className="text-[10px] text-[color:var(--text)] leading-snug">{marketCondition}</div>
      </div>

      {/* GO / NO-GO badge */}
      <div
        className="flex items-center gap-2.5 rounded-[6px] px-3 py-2.5"
        style={{
          background: decision === 'TRADE'
            ? 'linear-gradient(135deg, rgba(39,209,124,0.08), rgba(39,209,124,0.03))'
            : 'linear-gradient(135deg, rgba(240,70,104,0.08), rgba(240,70,104,0.03))',
          border: `1px solid ${decision === 'TRADE' ? 'rgba(39,209,124,0.2)' : 'rgba(240,70,104,0.2)'}`,
        }}
      >
        {decision === 'TRADE'
          ? <Shield size={16} className="text-[#27d17c]" />
          : <AlertTriangle size={16} className="text-[#f04668]" />}
        <div className="flex-1">
          <div className="text-xs font-bold" style={{ color: decision === 'TRADE' ? '#27d17c' : '#f04668' }}>
            {decision === 'TRADE' ? 'GO — CONDITIONS FAVOURABLE' : 'STAND ASIDE — PROTECT CAPITAL'}
          </div>
          {trade && (
            <div className="text-[10px] text-[color:var(--dim)] mt-0.5">
              Engine confidence {trade.confidence}%
              {trade.reasons?.[0] ? ` · ${trade.reasons[0]}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Top 3 strategies */}
      <div className="eyebrow text-[9px]">TOP 3 STRATEGIES BY SCORE</div>
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {top3.map((s) => (
            <StrategyCard key={s.code} s={s} rank={s.ranked} defaultOpen={s.ranked === 1} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
