import { Panel } from '../components/ui/Panel';
import { useTerminal } from '../store';
import { RegimePanel } from '../components/panels/RegimePanel';

// Phase 1: real option-positioning breadth from the engine (PCR, max-pain,
// support/resistance, gamma exposure). Phase deepens into A/D line, sector
// rotation and institutional participation.
export function MarketBreadth() {
  const pos = useTerminal((s) => s.snap?.positioning);
  const pcr = pos?.pcr ?? 0;
  // PCR > 1 = put-heavy (bearish hedging / bullish contrarian), < 1 = call-heavy.
  const pcrBias = pcr > 1.15 ? 'PUT-HEAVY' : pcr < 0.85 ? 'CALL-HEAVY' : 'BALANCED';
  const pcrColor = pcr > 1.15 ? '#16f5b0' : pcr < 0.85 ? '#ff2d6e' : '#ffb020';

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2.5">
      <Panel title="Market Regime" className="col-start-1 col-span-4 row-start-1 row-span-2" delay={0.04}>
        <RegimePanel />
      </Panel>

      <Panel
        title="Put / Call Positioning"
        accent="#ffb020"
        className="col-start-1 col-span-4 row-start-3 row-span-4"
        delay={0.08}
      >
        <div className="flex h-full flex-col justify-center gap-3">
          <div className="text-center">
            <div className="eyebrow">PCR (OI)</div>
            <div className="mono text-4xl font-extrabold" style={{ color: pcrColor }}>
              {pcr.toFixed(2)}
            </div>
            <div className="mt-1 text-[11px] font-bold tracking-widest" style={{ color: pcrColor }}>
              {pcrBias}
            </div>
          </div>
          <Bar value={Math.min(pcr / 2, 1)} color={pcrColor} />
          <div className="flex justify-between text-[9px] text-[color:var(--dim)]">
            <span>0.0 · call-heavy</span>
            <span>1.0</span>
            <span>2.0 · put-heavy ·</span>
          </div>
        </div>
      </Panel>

      <Panel
        title="Key Levels · Gamma Exposure"
        accent="#3fd6f5"
        className="col-start-5 col-span-8 row-start-1 row-span-6"
        delay={0.12}
      >
        <div className="grid h-full grid-cols-2 gap-3">
          <Stat label="MAX PAIN" value={fmt(pos?.maxPain)} accent="#ffb020" />
          <Stat label="GAMMA FLIP" value={fmt(pos?.gammaFlip ?? undefined)} accent="#c084fc" />
          <Levels label="SUPPORT" values={pos?.support ?? []} accent="#16f5b0" />
          <Levels label="RESISTANCE" values={pos?.resistance ?? []} accent="#ff2d6e" />
          <Stat label="NET GEX" value={fmt(pos?.gex)} accent="#3fd6f5" wide />
        </div>
      </Panel>
    </div>
  );
}

function fmt(v?: number | null) {
  if (v == null || !isFinite(v)) return '—';
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2);
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${value * 100}%`, background: `linear-gradient(90deg,${color}55,${color})`, boxShadow: `0 0 12px ${color}` }}
      />
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
    </div>
  );
}

function Stat({ label, value, accent, wide }: { label: string; value: string; accent: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col justify-center rounded-[6px] border border-white/5 bg-white/[0.02] p-3 ${wide ? 'col-span-2' : ''}`}>
      <div className="eyebrow">{label}</div>
      <div className="mono mt-1 text-2xl font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Levels({ label, values, accent }: { label: string; values: number[]; accent: string }) {
  return (
    <div className="flex flex-col justify-center rounded-[6px] border border-white/5 bg-white/[0.02] p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.length ? (
          values.slice(0, 4).map((v, i) => (
            <span
              key={i}
              className="mono rounded-md px-2 py-0.5 text-sm font-semibold"
              style={{ color: accent, background: `${accent}14`, border: `1px solid ${accent}30` }}
            >
              {Math.round(v).toLocaleString('en-IN')}
            </span>
          ))
        ) : (
          <span className="text-[color:var(--dim)]">—</span>
        )}
      </div>
    </div>
  );
}
