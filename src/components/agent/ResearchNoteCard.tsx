import { motion } from 'motion/react';
import type { ResearchNote, Verdict, SetupGrade } from '../../agent/types';

const VERDICT_COLOR: Record<Verdict, string> = {
  ENGAGE: 'var(--pos)',
  SCALE_IN: 'var(--info)',
  WAIT_FOR_TRIGGER: 'var(--gold)',
  REDUCE_RISK: 'var(--neg)',
  STAND_ASIDE: 'var(--dim)',
};

const GRADE_COLOR: Record<SetupGrade, string> = {
  A: 'var(--pos)', B: 'var(--info)', C: 'var(--gold)', D: 'var(--neg)', F: 'var(--dim)',
};

// The headline deliverable: the verdict, the thesis it rests on, and the
// conviction/grade that earned (or denied) capital.
export function ResearchNoteCard({ note }: { note: ResearchNote }) {
  const c = VERDICT_COLOR[note.verdict];
  const g = GRADE_COLOR[note.conviction.grade];

  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow text-[8px]">AGENT VERDICT</div>
            <motion.div key={note.verdict} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="text-[24px] font-extrabold leading-none tracking-tight" style={{ color: c }}>
              {note.verdict.replace(/_/g, ' ')}
            </motion.div>
            <div className="mt-1 text-[10px] text-[color:var(--dim)]">{note.headline}</div>
          </div>
          <div className="flex flex-col items-center rounded-md border px-2.5 py-1.5"
            style={{ borderColor: `color-mix(in srgb, ${g} 45%, transparent)`, background: `color-mix(in srgb, ${g} 10%, transparent)` }}>
            <div className="eyebrow text-[7px]">GRADE</div>
            <div className="text-[26px] font-black leading-none" style={{ color: g }}>{note.conviction.grade}</div>
          </div>
        </div>

        {/* conviction meter */}
        <div className="mt-3">
          <div className="flex items-end justify-between">
            <div className="eyebrow text-[8px]">CONVICTION</div>
            <div className="mono text-[15px] font-bold" style={{ color: g }}>
              {note.conviction.final.toFixed(0)}<span className="text-[9px] text-[color:var(--dim)]">/100</span>
            </div>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full rounded-full" style={{ background: g }}
              initial={{ width: 0 }} animate={{ width: `${note.conviction.final}%` }}
              transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
          </div>
          <div className="mt-1 flex justify-between text-[8px] text-[color:var(--dim)]">
            <span>confluence {(note.conviction.confluence * 100).toFixed(0)}%</span>
            <span>memory {note.conviction.memoryAdj >= 0 ? '+' : ''}{note.conviction.memoryAdj}</span>
            <span>dissonance {(note.conviction.dissonance * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* thesis */}
      <div className="cell px-2.5 py-2">
        <div className="flex items-center gap-2">
          <div className="eyebrow text-[8px]">THESIS</div>
          <span className="rounded px-1.5 py-px text-[8px] font-bold tracking-wider"
            style={{ color: 'var(--text)', background: 'rgba(255,255,255,.06)' }}>
            {note.thesis.structure.replace('_', ' ')}{note.thesis.stance !== 'NEUTRAL' ? ` · ${note.thesis.stance}` : ''}
          </span>
        </div>
        <div className="mt-1 text-[11px] leading-snug text-[color:var(--text)]">{note.thesis.statement}</div>
      </div>

      {/* sizing + trigger */}
      <div className="grid grid-cols-2 gap-2">
        <div className="cell px-2.5 py-2">
          <div className="eyebrow text-[8px]">RISK BUDGET</div>
          <div className="mono mt-0.5 text-[15px] font-bold" style={{ color: note.sizing.riskPctEquity > 0 ? 'var(--pos)' : 'var(--dim)' }}>
            {note.sizing.riskPctEquity.toFixed(2)}<span className="text-[9px] text-[color:var(--dim)]">% eq</span>
          </div>
          <div className="mt-0.5 text-[8px] leading-tight text-[color:var(--dim)]">{note.sizing.rationale}</div>
        </div>
        <div className="cell px-2.5 py-2">
          <div className="eyebrow text-[8px]">TRIGGER · WHAT CHANGES MY MIND</div>
          <div className="mt-0.5 text-[9px] leading-tight text-[color:var(--text)]">{note.trigger}</div>
        </div>
      </div>
    </div>
  );
}
