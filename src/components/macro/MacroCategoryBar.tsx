import type { CategoryScore } from '../../lib/macro/types';

// Per-category contribution to the regime score (diverging bars).
export function MacroCategoryBar({ cats }: { cats: CategoryScore[] }) {
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {cats.map((c) => {
        const color = c.score > 0.1 ? 'var(--pos)' : c.score < -0.1 ? 'var(--neg)' : 'var(--gold)';
        const w = Math.abs(c.score) * 50;
        return (
          <div key={c.category}>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-[color:var(--dim)]">{c.category}</span>
              <span className="mono font-semibold" style={{ color }}>
                {c.score > 0 ? '+' : ''}{(c.score * 100).toFixed(0)}
              </span>
            </div>
            <div className="relative mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
              <div className="absolute top-0 h-full" style={{ background: color, width: `${w}%`, left: c.score >= 0 ? '50%' : undefined, right: c.score < 0 ? '50%' : undefined }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
