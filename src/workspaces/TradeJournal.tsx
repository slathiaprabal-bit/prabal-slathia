import { Panel } from '../components/ui/Panel';
import { useTerminal } from '../store';
import { TradeDecisionPanel } from '../components/panels/TradeDecisionPanel';
import { inr } from '../lib/format';

// Phase 1: the live decision card + management rules. Phase 6 adds the
// persisted journal, win/loss analytics and adjustment history.
export function TradeJournal() {
  const trade = useTerminal((s) => s.snap?.trade);

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2.5">
      <Panel
        title="Live Decision"
        accent="#16f5b0"
        className="col-start-1 col-span-7 row-start-1 row-span-6"
        delay={0.04}
      >
        <TradeDecisionPanel />
      </Panel>

      <Panel
        title="Trade Management Rules"
        accent="#ff8a3d"
        className="col-start-8 col-span-5 row-start-1 row-span-6"
        delay={0.08}
      >
        <div className="flex h-full flex-col gap-2">
          <Rule label="STRUCTURE" value={trade?.structure?.replace(/_/g, ' ') ?? '—'} />
          <Rule label="TAKE PROFIT" value={trade ? inr(trade.takeProfit) : '—'} good />
          <Rule label="STOP LOSS" value={trade ? inr(trade.stopLoss) : '—'} bad />
          <Rule label="CREDIT / LOT" value={trade ? inr(trade.creditPerLot) : '—'} />
          <Rule
            label="ENTRY ZONE"
            value={trade?.shortPut && trade?.shortCall ? `${trade.shortPut} – ${trade.shortCall}` : '—'}
          />
          <div className="mt-1 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="eyebrow mb-1.5">DISCIPLINE</div>
            <ul className="space-y-1 text-[11px] leading-snug text-[color:var(--dim)]">
              <li>▸ Exit at take-profit; never widen the stop.</li>
              <li>▸ Roll the tested side before delta breaches 0.30.</li>
              <li>▸ Close into expiry-week gamma risk.</li>
              <li>▸ Stand aside when the regime says NO-GO.</li>
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Rule({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const color = good ? '#16f5b0' : bad ? '#ff7a8a' : 'var(--text)';
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <span className="eyebrow">{label}</span>
      <span className="mono text-sm font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
