import { useState } from 'react';
import { motion } from 'motion/react';
import { useTerminal } from '../store';
import { WORKSPACES } from '../workspaces/registry';

export function Sidebar() {
  const workspace = useTerminal((s) => s.workspace);
  const setWorkspace = useTerminal((s) => s.setWorkspace);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <aside className="sidebar flex flex-col items-center gap-1.5 py-4">
      {/* Logo pip */}
      <div
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          background: 'linear-gradient(135deg,#3fd6f5,#8b5cf6)',
          boxShadow: '0 0 22px rgba(63,214,245,0.45)',
        }}
      >
        <span className="text-[11px] font-black text-[#05070b]">VQ</span>
      </div>

      {WORKSPACES.map(({ id, icon: Icon, label, accent }) => {
        const active = workspace === id;
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => setWorkspace(id)}
            className="sidebar-item relative flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: active ? `${accent}1f` : 'transparent',
              border: active ? `1px solid ${accent}40` : '1px solid transparent',
              color: active ? accent : 'var(--dim)',
              boxShadow: active ? `0 0 18px ${accent}33` : 'none',
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onHoverStart={() => setHovered(id)}
            onHoverEnd={() => setHovered(null)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={17} />
            {/* active rail */}
            {active && (
              <motion.span
                layoutId="nav-rail"
                className="absolute -left-2 h-5 w-1 rounded-full"
                style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
              />
            )}
            {hovered === id && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-lg border border-white/10 bg-[#080c16]/95 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[color:var(--text)]"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}
              >
                {label}
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </aside>
  );
}
