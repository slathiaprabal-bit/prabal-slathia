import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { useTerminal } from '../store';

// Renders the instrumented backend error (type / origin / failing stage /
// inputs / full traceback) directly on screen, so a live throw is visible
// without opening a terminal. Demo data keeps flowing behind it.
export function ErrorBanner() {
  const error = useTerminal((s) => s.error);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  if (!error || !open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="absolute left-1/2 top-14 z-50 w-[min(840px,92vw)] -translate-x-1/2"
      >
        <div
          className="glass overflow-hidden border-[#f04668]/40"
          style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#f04668]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#f04668]">
                  Backend error · {error.type ?? 'Error'}
                </span>
                {error.failing_stage && (
                  <span className="mono rounded-[4px] bg-[#f04668]/15 px-1.5 py-0.5 text-[10px] text-[#f04668]">
                    stage: {error.failing_stage}
                  </span>
                )}
              </div>
              <div className="mono mt-1 text-xs text-[color:var(--text)] break-words">
                {error.error}
              </div>
              {error.origin && (
                <div className="mono mt-1 text-[11px] text-[#a78bfa] break-all">
                  ↳ {error.origin}
                </div>
              )}
              {error.stage_inputs && (
                <div className="mono mt-1 text-[10px] text-[color:var(--dim)] break-words">
                  inputs: {Object.entries(error.stage_inputs).map(([k, v]) => `${k}=${v}`).join('  ')}
                </div>
              )}

              {error.traceback && (
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="mt-2 flex items-center gap-1 text-[10px] tracking-wide text-[color:var(--dim)] hover:text-[color:var(--text)]"
                >
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                  {expanded ? 'Hide' : 'Show'} full traceback
                </button>
              )}
              <AnimatePresence>
                {expanded && error.traceback && (
                  <motion.pre
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mono mt-2 max-h-52 overflow-auto rounded-[6px] bg-black/40 p-3 text-[10px] leading-relaxed text-[#9fb6c9]"
                  >
                    {error.traceback}
                  </motion.pre>
                )}
              </AnimatePresence>
              <div className="mt-2 text-[10px] text-[color:var(--dim)]">
                Showing demo data until the live feed recovers.
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="shrink-0 text-[color:var(--dim)] hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
