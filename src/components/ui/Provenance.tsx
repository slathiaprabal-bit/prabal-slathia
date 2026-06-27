import { useTerminal } from '../../store';

// Honest data-provenance tag. Reads the backend source + chain synthetic flag
// so synthetic / cached data is never presented as live.
export function Provenance({ scope = 'price' }: { scope?: 'price' | 'chain' }) {
  const source = useTerminal((s) => s.snap?.source);
  const synthetic = useTerminal((s) => s.snap?.chainSynthetic);

  let label: string, color: string;
  if (scope === 'chain') {
    if (synthetic === false) { label = 'LIVE NSE CHAIN'; color = 'var(--pos)'; }
    else { label = 'SYNTHETIC CHAIN'; color = 'var(--gold)'; }
  } else {
    label = source === 'live' ? 'LIVE FEED' : source === 'cache' ? 'CACHED REAL' : 'SYNTHETIC';
    color = source === 'live' ? 'var(--pos)' : source === 'cache' ? 'var(--info)' : 'var(--gold)';
  }

  return (
    <span className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--line)] px-1.5 py-0.5"
      title={`Backend source: ${source ?? '—'}${scope === 'chain' ? ` · chain ${synthetic === false ? 'live' : 'synthetic'}` : ''}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[7px] font-semibold tracking-widest" style={{ color }}>{label}</span>
    </span>
  );
}
