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

// Machined panel: sharp 1px border, uppercase tracked header, soft depth.
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={`glass glass-hover relative flex min-h-0 flex-col overflow-hidden ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-[color:var(--line-soft)] px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-[2px] rounded-full" style={{ background: accent }} />
            <h2 className="section-title">{title}</h2>
          </div>
          {badge}
        </header>
      )}
      <div className="min-h-0 flex-1 px-3.5 py-3">{children}</div>
    </motion.section>
  );
}
