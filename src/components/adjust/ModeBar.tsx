import { MODE_META, legStr } from './shared';
import type { AdjMode, Position, VolContext } from '../../lib/adjust/types';

export function ModeBar({ mode, setMode, dte, setDte, position, vol, evaluated }: {
  mode: AdjMode; setMode: (m: AdjMode) => void; dte: number; setDte: (d: number) => void;
  position: Position; vol: VolContext; evaluated: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* mode selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(MODE_META) as AdjMode[]).map((m) => {
          const meta = MODE_META[m];
          const active = m === mode;
          return (
            <button key={m} onClick={() => setMode(m)}
              className="nav-item rounded-[7px] border px-2 py-1.5 text-left"
              style={{
                borderColor: active ? meta.color : 'var(--line-soft)',
                background: active ? `color-mix(in srgb, ${meta.color} 12%, transparent)` : undefined,
              }}>
              <div className="text-[11px] font-bold" style={{ color: active ? meta.color : 'var(--text)' }}>{meta.label}</div>
              <div className="text-[7.5px] leading-tight text-[color:var(--dim)]">{meta.blurb}</div>
            </button>
          );
        })}
      </div>

      {/* position + context */}
      <div className="cell flex flex-col gap-1 px-2.5 py-2">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-[8px]">CURRENT POSITION</span>
          <span className="text-[9px] font-semibold text-[color:var(--gold)]">{position.label}</span>
        </div>
        <div className="mono flex flex-wrap gap-1.5 text-[10px] text-[color:var(--text)]">
          {position.legs.map((l, i) => (
            <span key={i} className="rounded bg-white/[0.05] px-1.5 py-0.5">{legStr(l)}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Ctx label="SPOT" value={position.spot.toLocaleString('en-IN')} />
        <Ctx label="IV" value={`${(position.iv * 100).toFixed(1)}%`} />
        <Ctx label="IV RANK" value={position.ivRank.toFixed(0)} />
      </div>

      {/* DTE control */}
      <div className="cell px-2.5 py-2">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-[8px]">DAYS TO EXPIRY</span>
          <span className="mono text-[12px] font-bold text-[color:var(--text)]">{dte}d</span>
        </div>
        <input type="range" min={1} max={45} value={dte} onChange={(e) => setDte(Number(e.target.value))}
          className="mt-1 w-full accent-[color:var(--gold)]" />
      </div>

      <div className="mt-auto flex items-center justify-between text-[8px] text-[color:var(--faint)]">
        <span>{vol.driverEvent ? `Event: ${vol.driverEvent}` : `Regime ${position.regime}`}</span>
        <span>{evaluated.toLocaleString('en-IN')} combos evaluated</span>
      </div>
    </div>
  );
}

function Ctx({ label, value }: { label: string; value: string }) {
  return (
    <div className="cell px-1 py-1">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className="mono text-[12px] font-bold text-[color:var(--text)]">{value}</div>
    </div>
  );
}
