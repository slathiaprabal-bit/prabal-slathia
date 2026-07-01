import { inr, scoreColor } from './shared';
import type { Candidate } from '../../lib/adjust/types';

export function RankedList({ candidates, selectedId, onSelect }: {
  candidates: Candidate[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  if (!candidates.length) {
    return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Awaiting live position…</div>;
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-auto pr-0.5">
      {candidates.map((c, i) => {
        const sc = scoreColor(c.score);
        const sel = c.id === selectedId;
        const m = c.metrics;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)}
            className="nav-item rounded-[7px] border px-2.5 py-2 text-left"
            style={{ borderColor: sel ? sc : 'var(--line-soft)', background: sel ? `color-mix(in srgb, ${sc} 8%, transparent)` : undefined }}>
            <div className="flex items-center gap-2">
              <span className="mono flex h-6 w-8 shrink-0 items-center justify-center rounded-[5px] text-[13px] font-extrabold"
                style={{ color: sc, background: `color-mix(in srgb, ${sc} 14%, transparent)` }}>{c.score}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[color:var(--text)]">
                <span className="text-[color:var(--faint)]">#{i + 1} </span>{c.label}
              </span>
            </div>
            <div className="mono mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5px] text-[color:var(--dim)]">
              <span>θ <b style={{ color: m.theta >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{inr(m.theta)}/d</b></span>
              <span>POP <b className="text-[color:var(--text)]">{(m.pop * 100).toFixed(0)}%</b></span>
              <span>maxL <b style={{ color: 'var(--neg)' }}>{inr(m.maxLoss)}</b></span>
              <span>tail <b style={{ color: m.tailPayoff >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{inr(m.tailPayoff)}</b></span>
            </div>
            {sel && (
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {c.reasoning.map((r, j) => (
                  <li key={j} className="flex items-start gap-1 text-[9px] leading-snug text-[color:var(--dim)]">
                    <span className="mt-px shrink-0" style={{ color: sc }}>▸</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}
