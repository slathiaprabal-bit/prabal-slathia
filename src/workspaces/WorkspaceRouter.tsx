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
    <div className="flex h-full min-h-0 flex-col">
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-1">
        <span className="h-4 w-[2px] rounded-full" style={{ background: def.accent }} />
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[13px] font-bold tracking-tight text-white">{def.label}</h1>
          <div className="text-[9.5px] tracking-wide text-[color:var(--dim)]">{def.subtitle}</div>
        </div>
      </div>

      {/* Animated content swap — motion layer is absolutely positioned so the
          workspace grid's h-full resolves against a definite height (fills the
          viewport instead of collapsing to content). */}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={workspace}
            initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0 px-2.5 pb-2.5 pt-1"
          >
            <Active />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
