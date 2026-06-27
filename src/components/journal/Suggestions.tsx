import type { JournalState } from '../../lib/journal/types';

// Presentation-only — AI coaching / improvement suggestions from the engine.
export function Suggestions({ j }: { j: JournalState }) {
  return (
    <div className="flex h-full flex-col gap-1.5">
      {j.suggestions.map((s, i) => (
        <div key={i} className="flex items-start gap-2 cell px-3 py-2">
          <span className="mt-px text-[color:var(--gold)]">▸</span>
          <span className="text-[11px] leading-snug text-[color:var(--text)]/85">{s}</span>
        </div>
      ))}
    </div>
  );
}
