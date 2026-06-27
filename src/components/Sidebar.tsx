import { motion } from 'motion/react';
import { useTerminal } from '../store';
import { WORKSPACES } from '../workspaces/registry';

export function Sidebar() {
  const workspace = useTerminal((s) => s.workspace);
  const setWorkspace = useTerminal((s) => s.setWorkspace);
  const conn = useTerminal((s) => s.conn);
  const spot = useTerminal((s) => s.snap?.spot ?? 0);

  const live = conn === 'live';

  // Quick-view companion quotes: NIFTY derived from live spot, peers simulated
  // deterministically (presentation chrome — primary engine values stay live).
  const quick: [string, number, number][] = [
    ['NIFTY FUT', spot ? spot + 16 : 24072.5, -0.38],
    ['BANKNIFTY FUT', 54257.35, -0.41],
    ['FINNIFTY FUT', 24103.2, -0.28],
    ['SENSEX', 79302.11, -0.37],
  ];

  return (
    <aside className="sidebar flex flex-col">
      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2.5">
        {WORKSPACES.map(({ id, icon: Icon, label }) => {
          const active = workspace === id;
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => setWorkspace(id)}
              whileTap={{ scale: 0.985 }}
              className="nav-item relative flex items-center gap-3 px-3 py-2.5 text-left"
              style={{
                background: active ? 'rgba(244,183,64,0.07)' : undefined,
                borderColor: active ? 'rgba(244,183,64,0.22)' : undefined,
                color: active ? '#f4b740' : 'var(--dim)',
              }}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full"
                  style={{ background: '#f4b740' }}
                />
              )}
              <Icon size={16} strokeWidth={1.75} />
              <span className="text-[12.5px] font-medium tracking-tight" style={{ color: active ? '#f4d8a0' : 'var(--text)' }}>
                {label}
              </span>
            </motion.button>
          );
        })}
      </nav>

      {/* Market connection */}
      <div className="mx-2.5 mb-2 cell px-3 py-2.5">
        <Row label="MARKET CONNECTION" value={
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full pulse" style={{ background: live ? 'var(--pos)' : 'var(--gold)' }} />
            <span className="text-[10px] font-semibold" style={{ color: live ? 'var(--pos)' : 'var(--gold)' }}>
              {live ? 'LIVE' : 'DEMO'}
            </span>
          </span>
        } head />
        <Row label="WebSocket" value={<span className="text-[10px]" style={{ color: live ? 'var(--pos)' : 'var(--gold)' }}>{live ? 'Connected' : 'Reconnecting'}</span>} />
        <Row label="Latency" value={<span className="mono text-[10px] text-[color:var(--text)]">{live ? '12ms' : '—'}</span>} />
      </div>

      {/* Quick view */}
      <div className="mx-2.5 mb-2.5 cell px-3 py-2.5">
        <div className="eyebrow mb-2">QUICK VIEW</div>
        <div className="flex flex-col gap-1.5">
          {quick.map(([name, px, chg]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-[10.5px] text-[color:var(--dim)]">{name}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="mono text-[11px] font-semibold text-[color:var(--text)]">
                  {px.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
                <span className="mono text-[10px]" style={{ color: chg >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value, head }: { label: string; value: React.ReactNode; head?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={head ? 'eyebrow' : 'text-[10.5px] text-[color:var(--dim)]'}>{label}</span>
      {value}
    </div>
  );
}
