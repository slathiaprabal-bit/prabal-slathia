import { motion } from 'motion/react';
import { useTerminal } from '../../store';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { inr } from '../../lib/format';

export function TradeDecisionPanel() {
  const trade = useTerminal((s) => s.snap?.trade);
  if (!trade) return null;
  const go = trade.decision === 'TRADE';
  const accent = go ? '#27d17c' : '#f04668';

  return (
    <div className="flex h-full flex-col">
      {/* Verdict header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Decision Engine</div>
          <motion.div
            key={trade.decision}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: accent, textShadow: `0 0 22px ${accent}66` }}
          >
            {go ? trade.structure.replace(/_/g, ' ') : 'STAND ASIDE'}
          </motion.div>
        </div>
        <ConfDial value={trade.confidence} color={accent} />
      </div>

      {/* Score bars */}
      <div className="mt-3 space-y-2">
        <ScoreBar label="EDGE SCORE" value={trade.edgeScore} color="#5aa9ff" />
        <ScoreBar label="PREMIUM RICHNESS" value={trade.premiumRichness} color="#c79bff" />
      </div>

      {/* Metrics grid */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="EXP. RETURN" value={inr(trade.expectedReturn)} good />
        <Metric label="MAX LOSS" value={inr(trade.maxLoss)} bad />
        <Metric label="TAIL RISK" value={`${trade.tailRisk.toFixed(1)}%`} />
        <Metric label="ENTRY ZONE" value={trade.shortPut && trade.shortCall ? `${trade.shortPut}–${trade.shortCall}` : '—'} />
        <Metric label="TAKE PROFIT" value={inr(trade.takeProfit)} good />
        <Metric label="STOP" value={inr(trade.stopLoss)} bad />
      </div>

      {/* Reasons */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {(go ? trade.reasons : trade.rejectReasons).map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="mb-1 flex items-start gap-1.5 text-[11px] leading-snug"
          >
            <span style={{ color: accent }}>{go ? '▸' : '✕'}</span>
            <span className="text-[color:var(--dim)]">{r}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ConfDial({ value, color }: { value: number; color: string }) {
  return (
    <div className="text-right">
      <AnimatedNumber value={value} format={(v) => `${v.toFixed(0)}`} className="text-2xl font-bold" />
      <span className="text-sm font-bold" style={{ color }}>
        %
      </span>
      <div className="eyebrow text-[9px]">CONFIDENCE</div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[9px]">
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ color }}>
          {value.toFixed(0)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.6 }}
          style={{ background: `linear-gradient(90deg, ${color}55, ${color})` }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const color = good ? '#27d17c' : bad ? '#f04668' : 'var(--text)';
  return (
    <div className="cell px-2 py-1.5">
      <div className="eyebrow text-[9px]">{label}</div>
      <div className="mono text-sm font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
