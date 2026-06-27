import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart2, Layers, Cpu, Globe, TrendingUp, BookOpen, Bell, Settings
} from 'lucide-react';

const ITEMS = [
  { icon: BarChart2, label: 'Dashboard', active: true },
  { icon: Layers, label: 'Volatility' },
  { icon: Cpu, label: 'Strategy Engine' },
  { icon: Globe, label: 'Market Breadth' },
  { icon: TrendingUp, label: 'Macro' },
  { icon: BookOpen, label: 'Research' },
  { icon: Bell, label: 'Alerts' },
  { icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <aside className="sidebar flex flex-col items-center gap-1 py-4">
      {/* Logo pip */}
      <div
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          background: 'linear-gradient(135deg,#3fd6f5,#8b5cf6)',
          boxShadow: '0 0 22px rgba(63,214,245,0.45)',
        }}
      >
        <span className="text-[11px] font-black text-[#05060d]">VQ</span>
      </div>

      {ITEMS.map(({ icon: Icon, label, active }) => (
        <motion.button
          key={label}
          className="sidebar-item relative flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: active ? 'rgba(63,214,245,0.12)' : 'transparent',
            border: active ? '1px solid rgba(63,214,245,0.25)' : '1px solid transparent',
            color: active ? '#3fd6f5' : 'var(--dim)',
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onHoverStart={() => setHovered(label)}
          onHoverEnd={() => setHovered(null)}
          title={label}
        >
          <Icon size={17} />
          {hovered === label && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-lg border border-white/10 bg-[#0a0e1c]/95 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[color:var(--text)]"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}
            >
              {label}
            </motion.div>
          )}
        </motion.button>
      ))}
    </aside>
  );
}
