import { MODE_META, THESIS_META, AGGR_META } from './shared';
import type { AdjMode, Aggressiveness, MarketThesis, Position } from '../../lib/adjust/types';

const THESES = Object.keys(THESIS_META) as MarketThesis[];
const AGGRS = Object.keys(AGGR_META) as Aggressiveness[];

// The institutional flow: Market Thesis → Trader Objective → Constraints → Optimization.
export function ModeBar({ mode, setMode, thesis, setThesis, aggressiveness, setAggressiveness,
  dte, setDte, position, evaluated, onReset, degraded }: {
  mode: AdjMode; setMode: (m: AdjMode) => void;
  thesis: MarketThesis | null; setThesis: (t: MarketThesis) => void;
  aggressiveness: Aggressiveness; setAggressiveness: (a: Aggressiveness) => void;
  dte: number; setDte: (d: number) => void;
  position: Position; evaluated: number; onReset: () => void; degraded: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto pr-0.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[8px]">1 · MARKET THESIS {!thesis && <span className="text-[color:var(--gold)]">— required</span>}</span>
        <button onClick={onReset} className="nav-item rounded-[5px] border border-[color:var(--line)] px-2 py-0.5 text-[8.5px] font-bold tracking-wider text-[color:var(--dim)] hover:text-[color:var(--text)]">
          CHANGE POSITION
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {THESES.map((t) => {
          const meta = THESIS_META[t];
          const active = t === thesis;
          return (
            <button key={t} onClick={() => setThesis(t)}
              className="nav-item rounded-[6px] border px-2 py-1 text-left"
              style={{ borderColor: active ? meta.color : 'var(--line-soft)', background: active ? `color-mix(in srgb, ${meta.color} 14%, transparent)` : undefined }}>
              <div className="text-[10px] font-bold leading-tight" style={{ color: active ? meta.color : 'var(--text)' }}>{meta.label}</div>
              <div className="text-[7px] leading-tight text-[color:var(--dim)]">{meta.hint}</div>
            </button>
          );
        })}
      </div>

      <div className="eyebrow mt-0.5 text-[8px]">2 · TRADER OBJECTIVE</div>
      <div className="grid grid-cols-2 gap-1">
        {(Object.keys(MODE_META) as AdjMode[]).map((m) => {
          const meta = MODE_META[m];
          const active = m === mode;
          return (
            <button key={m} onClick={() => setMode(m)}
              className="nav-item rounded-[6px] border px-2 py-1 text-left"
              style={{ borderColor: active ? meta.color : 'var(--line-soft)', background: active ? `color-mix(in srgb, ${meta.color} 12%, transparent)` : undefined }}>
              <div className="text-[10px] font-bold leading-tight" style={{ color: active ? meta.color : 'var(--text)' }}>{meta.label}</div>
              <div className="text-[7px] leading-tight text-[color:var(--dim)]">{meta.blurb}</div>
            </button>
          );
        })}
      </div>

      {/* STEP 3 — aggressiveness shapes the Crash objective's profit-retain floor */}
      {mode === 'CRASH' && (
        <>
          <div className="eyebrow mt-0.5 text-[8px]">3 · AGGRESSIVENESS</div>
          <div className="grid grid-cols-3 gap-1">
            {AGGRS.map((ag) => {
              const meta = AGGR_META[ag];
              const active = ag === aggressiveness;
              return (
                <button key={ag} onClick={() => setAggressiveness(ag)}
                  className="nav-item rounded-[6px] border px-1.5 py-1 text-center"
                  style={{ borderColor: active ? 'var(--neg)' : 'var(--line-soft)', background: active ? 'color-mix(in srgb, var(--neg) 12%, transparent)' : undefined }}>
                  <div className="text-[9.5px] font-bold leading-tight" style={{ color: active ? 'var(--neg)' : 'var(--text)' }}>{meta.label}</div>
                  <div className="text-[6.5px] leading-tight text-[color:var(--dim)]">{meta.hint}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="cell mt-0.5 px-2.5 py-1.5">
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
