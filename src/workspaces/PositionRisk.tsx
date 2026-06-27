import { Panel } from '../components/ui/Panel';
import { RiskPanel } from '../components/panels/RiskPanel';
import { GreeksPanel } from '../components/panels/GreeksPanel';

// Phase 1: live portfolio Greeks + risk gauges + Monte-Carlo distribution.
// Phase 5 adds stress testing, scenario analysis and margin optimisation.
export function PositionRisk() {
  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2.5">
      <Panel
        title="Portfolio Greeks"
        accent="#c084fc"
        className="col-start-1 col-span-5 row-start-1 row-span-3"
        delay={0.04}
      >
        <GreeksPanel />
      </Panel>

      <Panel
        title="Risk · Monte-Carlo · Ruin"
        accent="#ff2d6e"
        className="col-start-6 col-span-7 row-start-1 row-span-6"
        delay={0.08}
      >
        <RiskPanel />
      </Panel>

      <Panel
        title="Greek Exposure Notes"
        className="col-start-1 col-span-5 row-start-4 row-span-3"
        delay={0.12}
      >
        <GreekNotes />
      </Panel>
    </div>
  );
}

function GreekNotes() {
  const NOTES: [string, string][] = [
    ['Δ Delta', 'Net directional exposure — keep small for premium-selling structures.'],
    ['Γ Gamma', 'Acceleration of delta — short gamma decays in your favour but spikes on gaps.'],
    ['Θ Theta', 'Daily time decay — the income engine of short-vol positions.'],
    ['ν Vega', 'IV sensitivity — short vega profits as implied volatility compresses.'],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {NOTES.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <div className="mono text-xs font-bold text-[color:var(--neon)]">{k}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-[color:var(--dim)]">{v}</div>
        </div>
      ))}
    </div>
  );
}
