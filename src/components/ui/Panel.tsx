import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  badge?: ReactNode;
  accent?: string;
  className?: string;
  children: ReactNode;
  delay?: number;
}

// Floating glass card: large radius, thin glass border, glowing accent dot,
// uppercase tracked header, generous breathing room. Purely presentational.
export function Panel({
  title,
  badge,
  accent = 'var(--dim)',
  className = '',
  children,
  delay = 0,
}: PanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 0.8, 0.24, 1] }}
      className={`glass glass-hover relative flex min-h-0 flex-col overflow-hidden ${className}`}
    >
      {title && (
        <header className="panel-head flex items-center justify-between border-b border-[color:var(--line-soft)]">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
            />
            <h2 className="section-title text-[10px]">{title}</h2>
          </div>
          {badge}
        </header>
      )}
      <div className="panel-body min-h-0 flex-1">{children}</div>
    </motion.section>
  );
}
