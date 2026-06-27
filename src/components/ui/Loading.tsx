import { motion } from 'motion/react';

// Full-screen boot state shown until the first snapshot (live or demo) arrives.
export function Loading() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5">
      <motion.div
        className="flex h-14 w-14 items-center justify-center rounded-xl border border-[color:var(--gold)]/30"
        style={{ background: 'linear-gradient(160deg,#15120a,#0a0a0a)' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-base font-black text-[color:var(--gold)]">VQ</span>
      </motion.div>
      <div className="text-center">
        <div className="text-sm font-extrabold tracking-widest text-white">VOLARA QUANT TERMINAL</div>
        <motion.div
          className="eyebrow mt-1"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          Initialising market intelligence…
        </motion.div>
      </div>
      <div className="flex w-56 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-1.5 flex-1" />
        ))}
      </div>
    </div>
  );
}
