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

export function Panel({
  title,
  badge,
  accent = '#3fd6f5',
  className = '',
  children,
  delay = 0,
}: PanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={`glass glass-hover relative flex min-h-0 flex-col overflow-hidden ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-[3px] rounded-full"
              style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
            />
            <h2 className="eyebrow">{title}</h2>
          </div>
          {badge}
        </header>
      )}
      <div className="min-h-0 flex-1 px-4 pb-3">{children}</div>
    </motion.section>
  );
}
