import { Panel } from '../components/ui/Panel';
import { useTerminal } from '../store';
import { useDealer } from '../lib/dealer/useDealer';
import { useHmm } from '../lib/hmm/useHmm';
import { HmmRegimePanel } from '../components/hmm/HmmRegimePanel';
import { DealerPositioning } from '../components/dealer/DealerPositioning';
import { Provenance } from '../components/ui/Provenance';

// Phase 3 · P2+P3+P4 — institutional dealer positioning (GEX, gamma flip,
// vanna/charm, max pain) + Hidden Markov regime detection + PCR breadth.
export function MarketBreadth() {
  const pos = useTerminal((s) => s.snap?.positioning);
  const dealer = useDealer();
  const hmm = useHmm();
  const pcr = pos?.pcr ?? 0;
  const pcrBias = pcr > 1.15 ? 'PUT-HEAVY' : pcr < 0.85 ? 'CALL-HEAVY' : 'BALANCED';
  const pcrColor = pcr > 1.15 ? 'var(--pos)' : pcr < 0.85 ? 'var(--neg)' : 'var(--gold)';

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Hidden Markov Regime" accent="var(--violet)" className="col-start-1 col-span-4 row-start-1 row-span-3" delay={0.04}>
        {hmm ? <HmmRegimePanel h={hmm} /> : <Empty />}
      </Panel>

      <Panel title="Put / Call Positioning" accent="var(--gold)" className="col-start-1 col-span-4 row-start-4 row-span-3" delay={0.08}>
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
            <Mini label="CALL WALL" value={dealer ? Math.round(dealer.callWall).toLocaleString('en-IN') : '—'} color="var(--neg)" />
            <Mini label="PUT WALL" value={dealer ? Math.round(dealer.putWall).toLocaleString('en-IN') : '—'} color="var(--pos)" />
          </div>
        </div>
      </Panel>

      <Panel
        title="Dealer Positioning · Gamma Exposure"
        accent="var(--info)"
        className="col-start-5 col-span-8 row-start-1 row-span-6"
        delay={0.12}
        badge={<Provenance scope="chain" />}
      >
        {dealer ? <DealerPositioning d={dealer} /> : <Empty />}
      </Panel>
    </div>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Computing dealer positioning…</div>;
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="cell px-2.5 py-1.5 text-center">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="mono mt-0.5 text-[13px] font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}
