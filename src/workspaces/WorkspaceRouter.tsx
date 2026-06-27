import { AnimatePresence, motion } from 'motion/react';
import { useTerminal } from '../store';
import { WORKSPACE_MAP } from './registry';

// State-driven workspace switcher. The WebSocket feed lives in the global store
// so switching here never tears down the live connection.
export function WorkspaceRouter() {
  const workspace = useTerminal((s) => s.workspace);
  const def = WORKSPACE_MAP[workspace];
  const Active = def.Component;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Workspace header */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-1">
        <span className="h-5 w-[3px] rounded-full" style={{ background: def.accent, boxShadow: `0 0 12px ${def.accent}` }} />
        <div>
          <h1 className="text-sm font-extrabold tracking-tight text-white">{def.label}</h1>
          <div className="text-[10px] tracking-wide text-[color:var(--dim)]">{def.subtitle}</div>
        </div>
      </div>

      {/* Animated content swap */}
      <div className="relative min-h-0 flex-1 p-3 pt-1.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={workspace}
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            className="h-full min-h-0"
          >
            <Active />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
