// The agent "thinking out loud" — the full chain of reasoning that produced
// the verdict, in a discretionary trader's voice. Transparency is the point:
// every conclusion is traceable to the step that produced it.
export function Narrative({ lines }: { lines: string[] }) {
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-auto pr-0.5">
      {lines.map((l, i) => {
        const dash = l.indexOf('—');
        const head = dash > 0 ? l.slice(0, dash).trim() : '';
        const body = dash > 0 ? l.slice(dash + 1).trim() : l;
        return (
          <div key={i} className="flex gap-2 text-[10px] leading-snug">
            <span className="mono mt-px shrink-0 text-[color:var(--dim)]">{String(i + 1).padStart(2, '0')}</span>
            <p className="text-[color:var(--text)]">
              {head && <span className="font-bold tracking-wide text-[color:var(--info)]">{head} — </span>}
              {body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
