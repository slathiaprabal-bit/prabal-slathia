import { Panel } from '../components/ui/Panel';
import { MacroPanel } from '../components/panels/MacroPanel';

// Phase 1: existing macro panel full-width. Phase 4 builds the dedicated macro
// workspace (silver, copper, repo, inflation, GDP, economic calendar, regime).
export function MacroIntelligence() {
  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-1 gap-2.5">
      <Panel
        title="Macro Intelligence"
        accent="#c084fc"
        className="col-span-12 row-span-1"
        delay={0.04}
      >
        <MacroPanel />
      </Panel>
    </div>
  );
}
