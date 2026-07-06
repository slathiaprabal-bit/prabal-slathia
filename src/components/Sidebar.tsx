import { motion } from 'motion/react';
import { useTerminal } from '../store';
import { WORKSPACES } from '../workspaces/registry';

export function Sidebar() {
  const workspace = useTerminal((s) => s.workspace);
  const setWorkspace = useTerminal((s) => s.setWorkspace);
  const conn = useTerminal((s) => s.conn);
  const spot = useTerminal((s) => s.snap?.spot ?? 0);
  const sec = useTerminal((s) => s.snap?.secondary);

  const live = conn === 'live';

  // Quick-view companion quotes: NIFTY derived from live spot; BankNifty,
  // FinNifty and Sensex come from the live secondary-index feed (null until a
  // snapshot arrives, rendered as a placeholder).
  const quick: [string, number | null, number | null][] = [
    ['NIFTY FUT', spot ? spot + 16 : null, -0.38],
    ['BANKNIFTY FUT', sec?.banknifty.value ?? null, sec?.banknifty.chg ?? null],
    ['FINNIFTY FUT', sec?.finnifty.value ?? null, sec?.finnifty.chg ?? null],
    ['SENSEX', sec?.sensex.value ?? null, sec?.sensex.chg ?? null],
  ];

  return (
    <aside className="sidebar flex flex-col">
      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {WORKSPACES.map(({ id, icon: Icon, label }) => {
          const active = workspace === id;
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => setWorkspace(id)}
              whileTap={{ scale: 0.985 }}
              className="nav-item relative flex items-center gap-2.5 px-2.5 py-2 text-left"
              style={{
                background: active ? 'rgba(139,92,246,0.1)' : undefined,
                borderColor: active ? 'rgba(139,92,246,0.3)' : undefined,
                color: active ? '#a78bfa' : 'var(--dim)',
              }}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full"
                  style={{ background: '#a78bfa' }}
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
                  {px != null ? px.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                </span>
                <span className="mono text-[10px]" style={{ color: (chg ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {chg != null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '—'}
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
