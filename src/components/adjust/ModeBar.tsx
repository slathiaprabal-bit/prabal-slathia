import { MODE_META } from './shared';
import type { AdjMode, Position } from '../../lib/adjust/types';

export function ModeBar({ mode, setMode, dte, setDte, position, evaluated, onReset, degraded }: {
  mode: AdjMode; setMode: (m: AdjMode) => void; dte: number; setDte: (d: number) => void;
  position: Position; evaluated: number; onReset: () => void; degraded: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[8px]">OPTIMIZATION OBJECTIVE</span>
        <button onClick={onReset} className="nav-item rounded-[5px] border border-[color:var(--line)] px-2 py-0.5 text-[8.5px] font-bold tracking-wider text-[color:var(--dim)] hover:text-[color:var(--text)]">
          CHANGE POSITION
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(MODE_META) as AdjMode[]).map((m) => {
          const meta = MODE_META[m];
          const active = m === mode;
          return (
            <button key={m} onClick={() => setMode(m)}
              className="nav-item rounded-[7px] border px-2 py-1.5 text-left"
              style={{ borderColor: active ? meta.color : 'var(--line-soft)', background: active ? `color-mix(in srgb, ${meta.color} 12%, transparent)` : undefined }}>
              <div className="text-[11px] font-bold" style={{ color: active ? meta.color : 'var(--text)' }}>{meta.label}</div>
              <div className="text-[7.5px] leading-tight text-[color:var(--dim)]">{meta.blurb}</div>
            </button>
          );
        })}
      </div>

      <div className="cell px-2.5 py-2">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-[8px]">DAYS TO EXPIRY</span>
          <span className="mono text-[12px] font-bold text-[color:var(--text)]">{dte}d</span>
        </div>
        <input type="range" min={0} max={45} value={dte} onChange={(e) => setDte(Number(e.target.value))} className="mt-1 w-full accent-[color:var(--gold)]" />
      </div>

      <div className="mt-auto flex items-center justify-between text-[8px] text-[color:var(--faint)]">
        <span>{position.instrument} · {evaluated.toLocaleString('en-IN')} combos</span>
        {degraded && <span className="text-[color:var(--gold)]">structure: fallback</span>}
      </div>
    </div>
  );
}
