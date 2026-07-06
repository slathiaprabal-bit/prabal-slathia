import { Panel } from '../components/ui/Panel';
import { useTerminal } from '../store';
import { WORKSPACES } from './registry';

const CONN_LABEL: Record<string, { text: string; color: string }> = {
  live: { text: 'LIVE · WebSocket streaming', color: '#27d17c' },
  mock: { text: 'DEMO · simulated feed', color: '#a78bfa' },
  error: { text: 'ERROR · backend traceback', color: '#f04668' },
  connecting: { text: 'CONNECTING…', color: '#5aa9ff' },
};

export function SettingsWorkspace() {
  const conn = useTerminal((s) => s.conn);
  const snap = useTerminal((s) => s.snap);
  const setWorkspace = useTerminal((s) => s.setWorkspace);
  const c = CONN_LABEL[conn] ?? CONN_LABEL.connecting;
  const wsUrl = `ws://${location.hostname}:8000/ws/stream`;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Connection" accent="#5aa9ff" className="col-start-1 col-span-6 row-start-1 row-span-3" delay={0.04}>
        <div className="flex h-full flex-col justify-center gap-2.5">
          <Row label="STATUS">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full pulse" style={{ background: c.color }} />
              <span className="text-sm font-semibold" style={{ color: c.color }}>{c.text}</span>
            </span>
          </Row>
          <Row label="WEBSOCKET"><span className="mono text-xs text-[color:var(--text)]">{wsUrl}</span></Row>
          <Row label="DATA SOURCE"><span className="mono text-xs text-[color:var(--text)]">{snap?.source ?? '—'}</span></Row>
          <Row label="LAST FRAME">
            <span className="mono text-xs text-[color:var(--text)]">
              {snap?.ts ? new Date(snap.ts).toLocaleTimeString('en-IN', { hour12: false }) : '—'}
            </span>
          </Row>
          <button
            onClick={() => location.reload()}
            className="mt-1 rounded-[6px] border border-[#5aa9ff]/25 bg-[#5aa9ff]/10 py-2 text-xs font-bold tracking-widest text-[#5aa9ff] transition hover:bg-[#5aa9ff]/20"
          >
            RECONNECT TERMINAL
          </button>
        </div>
      </Panel>

      <Panel title="Appearance" accent="#c79bff" className="col-start-7 col-span-6 row-start-1 row-span-3" delay={0.08}>
        <div className="flex h-full flex-col justify-center gap-2">
          <div className="eyebrow mb-1">WORKSPACE ACCENTS</div>
          <div className="grid grid-cols-2 gap-2">
            {WORKSPACES.map((w) => (
              <div key={w.id} className="cell flex items-center gap-2 px-2.5 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.accent }} />
                <span className="text-[11px] font-semibold text-[color:var(--text)]">{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Workspaces" accent="#27d17c" className="col-start-1 col-span-12 row-start-4 row-span-3" delay={0.12}>
        <div className="grid h-full grid-cols-4 content-center gap-2.5">
          {WORKSPACES.map((w) => (
            <button
              key={w.id}
              onClick={() => setWorkspace(w.id)}
              className="nav-item flex flex-col items-start gap-1 border border-[color:var(--line)] bg-[color:var(--panel)] p-3 text-left"
            >
              <span className="flex items-center gap-2">
                <w.icon size={15} style={{ color: w.accent }} />
                <span className="text-xs font-bold text-[color:var(--text)]">{w.label}</span>
              </span>
              <span className="text-[10px] leading-snug text-[color:var(--dim)]">{w.subtitle}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between cell px-3 py-2">
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  );
}
