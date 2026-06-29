import type { PreMortem } from '../../agent/types';

// The disconfirmation panel — "assume this trade has already failed; why?".
// Failure modes are ranked by likelihood × severity. The invalidation level is
// the pre-committed exit that keeps a losing thesis from becoming a big loss.
export function PreMortemPanel({ pm }: { pm: PreMortem }) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-auto pr-0.5">
      <div>
        <div className="eyebrow text-[8px]">FAILURE MODES (likelihood × severity)</div>
        <div className="mt-1 flex flex-col gap-1">
          {pm.failureModes.map((f, i) => {
            const risk = f.likelihood * f.severity;
            const color = risk >= 0.45 ? 'var(--neg)' : risk >= 0.25 ? 'var(--gold)' : 'var(--dim)';
            return (
              <div key={i} className="cell px-2 py-1.5">
                <div className="flex items-start gap-2">
                  <span className="mono mt-px text-[9px] font-bold" style={{ color }}>{(risk * 100).toFixed(0)}</span>
                  <span className="text-[9px] leading-tight text-[color:var(--text)]">{f.scenario}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="cell px-2.5 py-2" style={{ borderColor: 'color-mix(in srgb, var(--neg) 35%, transparent)' }}>
        <div className="eyebrow text-[8px]" style={{ color: 'var(--neg)' }}>INVALIDATION — EXIT TRIGGER</div>
        <div className="mt-0.5 text-[10px] leading-snug text-[color:var(--text)]">{pm.invalidation}</div>
      </div>

      <div className="cell px-2.5 py-2">
        <div className="eyebrow text-[8px]">WORST CASE</div>
        <div className="mt-0.5 text-[9px] leading-snug text-[color:var(--dim)]">{pm.worstCase}</div>
      </div>
    </div>
  );
}
