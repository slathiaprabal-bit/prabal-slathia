import { useMemo } from 'react';
import { useReplay, type CyclePhase } from '../../lib/vol/replay';

const PHASE_META: Record<CyclePhase, { label: string; color: string }> = {
  COMPRESSION: { label: 'Compression', color: 'var(--pos)' },
  NEUTRAL: { label: 'Neutral', color: 'var(--gold)' },
  EXPANSION: { label: 'Expansion', color: 'var(--neg)' },
};
const PHASES: CyclePhase[] = ['COMPRESSION', 'NEUTRAL', 'EXPANSION'];

// Where volatility sits in its intraday lifecycle: session share per phase and
// a scrubbable timeline of real recorded moments. Selecting a moment re-renders
// the smile, term structure, surface and engine at that time.
export function VolCycleReplay() {
  const { moments, cycle, activeTs, setActiveTs } = useReplay();

  // Transition points — the moments where the phase changed (plus the first).
  const transitions = useMemo(() => moments.filter((m, i) => i === 0 || m.phase !== moments[i - 1].phase), [moments]);

  if (!moments.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
        <div className="eyebrow text-[8px]">SESSION REPLAY</div>
        <div className="text-[9.5px] leading-relaxed text-[color:var(--dim)]">
          Recording volatility state every 5 minutes. The intraday timeline appears
          as the session's real samples accumulate.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* session share per phase */}
      <div className="flex flex-col gap-1">
        {PHASES.map((p) => (
          <div key={p} className="flex items-center gap-2">
            <span className="w-[70px] shrink-0 text-[8.5px] text-[color:var(--dim)]">{PHASE_META[p].label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full" style={{ width: `${cycle[p] * 100}%`, background: PHASE_META[p].color }} />
            </div>
            <span className="mono w-7 shrink-0 text-right text-[8.5px] text-[color:var(--text)]">{Math.round(cycle[p] * 100)}%</span>
          </div>
        ))}
      </div>

      {/* scrubbable phase strip — one segment per recorded sample */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow text-[7.5px]">SESSION TIMELINE · 5-MIN SAMPLES</span>
          {activeTs
            ? <button onClick={() => setActiveTs(null)}
                className="rounded-[3px] border border-[color:var(--gold)] px-1.5 py-px text-[7.5px] font-bold tracking-wider text-[color:var(--gold)]">
                ◂ BACK TO LIVE
              </button>
            : <span className="text-[7.5px] font-bold tracking-wider text-[color:var(--pos)]">● LIVE</span>}
        </div>
        <div className="flex h-4 gap-px overflow-hidden rounded-[3px]">
          {moments.map((m) => (
            <button key={m.sample.ts} title={`${m.sample.t} · ${PHASE_META[m.phase].label} · score ${m.score.toFixed(0)}`}
              onClick={() => setActiveTs(m.sample.ts === activeTs ? null : m.sample.ts)}
              className="min-w-0 flex-1 transition-opacity"
              style={{
                background: PHASE_META[m.phase].color,
                opacity: activeTs == null ? 0.75 : m.sample.ts === activeTs ? 1 : 0.25,
              }} />
          ))}
        </div>
        <div className="mono mt-0.5 flex justify-between text-[7px] text-[color:var(--faint)]">
          <span>{moments[0].sample.t}</span>
          <span>{moments[moments.length - 1].sample.t}</span>
        </div>
      </div>

      {/* phase-transition log */}
      <div className="min-h-0 flex-1 overflow-auto pr-0.5">
        {transitions.map((m) => {
          const active = m.sample.ts === activeTs;
          return (
            <button key={m.sample.ts} onClick={() => setActiveTs(active ? null : m.sample.ts)}
              className="flex w-full items-center justify-between border-b border-[color:var(--line-soft)] px-1 py-1 text-left hover:bg-white/[0.03]"
              style={{ background: active ? 'rgba(255,255,255,0.05)' : undefined }}>
              <span className="mono text-[9px] text-[color:var(--text)]">{m.sample.t}</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: PHASE_META[m.phase].color }} />
                <span className="text-[9px] font-semibold" style={{ color: PHASE_META[m.phase].color }}>{PHASE_META[m.phase].label}</span>
                <span className="mono text-[8px] text-[color:var(--faint)]">{m.score.toFixed(0)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
