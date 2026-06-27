import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTerminal } from '../../store';
import { num } from '../../lib/format';
import type { ChainRow } from '../../types';

export function OptionChainHeatmap() {
  const snap = useTerminal((s) => s.snap);
  const [sel, setSel] = useState<number | null>(null);
  if (!snap) return null;
  const chain = snap.chain;
  const spot = snap.spot;
  const maxPain = snap.positioning.maxPain;
  const maxOI = Math.max(...chain.flatMap((r) => [r.ceOI, r.peOI]), 1);

  // Show a window of strikes around spot.
  const atmIdx = chain.reduce(
    (best, r, i) => (Math.abs(r.strike - spot) < Math.abs(chain[best].strike - spot) ? i : best),
    0,
  );
  const lo = Math.max(0, atmIdx - 11);
  const view = chain.slice(lo, lo + 22);
  const selectedRow = chain.find((r) => r.strike === sel);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex justify-between text-[9px] text-[color:var(--dim)]">
        <span>PUT OI</span>
        <span>STRIKE</span>
        <span>CALL OI</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {view.map((r) => {
          const pe = r.peOI / maxOI;
          const ce = r.ceOI / maxOI;
          const isATM = Math.abs(r.strike - spot) < 25;
          const isMaxPain = Math.abs(r.strike - maxPain) < 25;
          return (
            <button
              key={r.strike}
              onClick={() => setSel(sel === r.strike ? null : r.strike)}
              className="group grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 py-[3px]"
            >
              {/* PUT bar (right-aligned) */}
              <div className="flex h-3.5 justify-end overflow-hidden rounded-l">
                <motion.div
                  className="h-full rounded-l"
                  animate={{ width: `${pe * 100}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ background: `rgba(240,70,104,${0.25 + pe * 0.6})`, boxShadow: pe > 0.6 ? '0 0 8px rgba(240,70,104,0.5)' : 'none' }}
                />
              </div>
              <span
                className={`mono w-12 rounded px-1 text-center text-[11px] ${
                  isATM ? 'bg-white/10 font-bold text-white' : 'text-[color:var(--dim)]'
                }`}
                style={isMaxPain ? { color: '#f4b740', textShadow: '0 0 8px rgba(255,209,102,0.6)' } : {}}
              >
                {r.strike}
              </span>
              {/* CALL bar */}
              <div className="flex h-3.5 overflow-hidden rounded-r">
                <motion.div
                  className="h-full rounded-r"
                  animate={{ width: `${ce * 100}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ background: `rgba(90,169,255,${0.25 + ce * 0.6})`, boxShadow: ce > 0.6 ? '0 0 8px rgba(90,169,255,0.5)' : 'none' }}
                />
              </div>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {selectedRow && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 overflow-hidden rounded-[6px] border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <StrikeDetail row={selectedRow} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StrikeDetail({ row }: { row: ChainRow }) {
  const pcr = row.ceOI > 0 ? row.peOI / row.ceOI : 0;
  return (
    <div>
      <div className="mono mb-1 text-sm font-bold text-white">{row.strike} STRIKE</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
        <Row k="Call OI" v={num(row.ceOI / 1000, 0) + 'k'} />
        <Row k="Put OI" v={num(row.peOI / 1000, 0) + 'k'} />
        <Row k="Call IV" v={num(row.ceIV, 1) + '%'} />
        <Row k="Put IV" v={num(row.peIV, 1) + '%'} />
        <Row k="Strike PCR" v={num(pcr, 2)} />
        <Row k="OI total" v={num((row.ceOI + row.peOI) / 1000, 0) + 'k'} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--dim)]">{k}</span>
      <span className="mono text-[color:var(--text)]">{v}</span>
    </div>
  );
}
