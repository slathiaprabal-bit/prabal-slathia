import { Panel } from '../components/ui/Panel';
import { useTerminal } from '../store';
import { RegimePanel } from '../components/panels/RegimePanel';

// Option-positioning breadth from the engine: PCR, max-pain, support /
// resistance, gamma exposure — rendered as a dealer-level price ladder.
export function MarketBreadth() {
  const pos = useTerminal((s) => s.snap?.positioning);
  const spot = useTerminal((s) => s.snap?.spot ?? 0);
  const pcr = pos?.pcr ?? 0;
  const pcrBias = pcr > 1.15 ? 'PUT-HEAVY' : pcr < 0.85 ? 'CALL-HEAVY' : 'BALANCED';
  const pcrColor = pcr > 1.15 ? 'var(--pos)' : pcr < 0.85 ? 'var(--neg)' : 'var(--gold)';

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Market Regime" className="col-start-1 col-span-4 row-start-1 row-span-2" delay={0.04}>
        <RegimePanel />
      </Panel>

      <Panel title="Put / Call Positioning" accent="var(--gold)" className="col-start-1 col-span-4 row-start-3 row-span-4" delay={0.08}>
        <div className="flex h-full flex-col justify-between py-1">
          <div className="text-center">
            <div className="eyebrow">PCR · OPEN INTEREST</div>
            <div className="mono mt-1 text-3xl font-bold" style={{ color: pcrColor }}>{pcr.toFixed(2)}</div>
            <div className="text-[10px] font-bold tracking-widest" style={{ color: pcrColor }}>{pcrBias}</div>
          </div>
          <div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(pcr / 2, 1) * 100}%`, background: pcrColor }} />
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-[color:var(--dim)]">
              <span>0.0 call-heavy</span><span>1.0</span><span>2.0 put-heavy</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="MAX PAIN" value={fmt(pos?.maxPain)} color="var(--gold)" />
            <Stat label="NET GEX" value={fmt(pos?.gex)} color="var(--info)" />
          </div>
        </div>
      </Panel>

      <Panel title="Dealer Levels · Gamma Exposure" accent="var(--info)" className="col-start-5 col-span-8 row-start-1 row-span-6" delay={0.12}>
        <StrikeLadder
          spot={spot}
          maxPain={pos?.maxPain}
          gammaFlip={pos?.gammaFlip ?? undefined}
          support={pos?.support ?? []}
          resistance={pos?.resistance ?? []}
        />
      </Panel>
    </div>
  );
}

function StrikeLadder({ spot, maxPain, gammaFlip, support, resistance }: {
  spot: number; maxPain?: number; gammaFlip?: number; support: number[]; resistance: number[];
}) {
  type Lvl = { v: number; label: string; color: string; emphasis?: boolean };
  const levels: Lvl[] = [];
  resistance.slice(0, 4).forEach((v, i) => levels.push({ v, label: `Resistance ${i + 1}`, color: 'var(--neg)' }));
  support.slice(0, 4).forEach((v, i) => levels.push({ v, label: `Support ${i + 1}`, color: 'var(--pos)' }));
  if (maxPain) levels.push({ v: maxPain, label: 'Max Pain', color: 'var(--gold)' });
  if (gammaFlip) levels.push({ v: gammaFlip, label: 'Gamma Flip', color: 'var(--violet)' });
  if (spot) levels.push({ v: spot, label: 'Spot', color: 'var(--text)', emphasis: true });

  const vals = levels.map((l) => l.v);
  const min = Math.min(...vals) * 0.999;
  const max = Math.max(...vals) * 1.001;
  const span = max - min || 1;
  const y = (v: number) => ((max - v) / span) * 100;

  // Sort for the side legend (high strike first).
  const sorted = [...levels].sort((a, b) => b.v - a.v);

  return (
    <div className="flex h-full gap-3">
      {/* Ladder rail */}
      <div className="relative h-full flex-1">
        {levels.map((l, i) => (
          <div key={i} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: `${y(l.v)}%`, transform: 'translateY(-50%)' }}>
            <span className="w-20 shrink-0 text-right text-[9px] tracking-wide" style={{ color: l.color }}>{l.label}</span>
            <span
              className="h-px flex-1"
              style={{ background: l.emphasis ? 'var(--text)' : l.color, opacity: l.emphasis ? 0.9 : 0.5, height: l.emphasis ? 2 : 1 }}
            />
            <span className="mono w-16 shrink-0 text-[11px] font-semibold" style={{ color: l.color }}>
              {Math.round(l.v).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>

      {/* Legend / table */}
      <div className="flex w-40 shrink-0 flex-col justify-center gap-1 border-l border-[color:var(--line-soft)] pl-3">
        <div className="eyebrow mb-1">LEVELS · {sorted.length}</div>
        {sorted.map((l, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
              <span className="text-[10px] text-[color:var(--dim)]">{l.label}</span>
            </span>
            <span className="mono text-[10.5px] font-semibold" style={{ color: l.color }}>{Math.round(l.v).toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="cell px-2.5 py-1.5">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="mono mt-0.5 text-base font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function fmt(v?: number | null) {
  if (v == null || !isFinite(v)) return '—';
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2);
}
