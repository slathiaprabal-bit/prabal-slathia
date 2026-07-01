import { useMemo, useState } from 'react';
import type { Snapshot } from '../../types';
import type { LoadedLeg, LoadedPosition, OptKind } from '../../lib/adjust/types';
import { fromSnapshotTrade, parseBrokerText } from '../../lib/adjust/position';
import { INSTRUMENT_NAMES, characteristics } from '../../lib/adjust/instruments';
import { legStr } from './shared';

type Tab = 'BROKER' | 'STRATEGY_LAB' | 'MANUAL';
const TABS: { id: Tab; label: string }[] = [
  { id: 'BROKER', label: 'Import Broker' },
  { id: 'STRATEGY_LAB', label: 'Open Existing' },
  { id: 'MANUAL', label: 'Build Manually' },
];

export function PositionLoader({ snap, onLoad }: { snap: Snapshot | null; onLoad: (p: LoadedPosition) => void }) {
  const [tab, setTab] = useState<Tab>('STRATEGY_LAB');
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <div className="text-[13px] font-bold text-[color:var(--text)]">Load a position to optimize</div>
        <div className="text-[10px] text-[color:var(--dim)]">Every Greek, margin and recommendation is computed from your actual position — no demo data.</div>
      </div>
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="nav-item rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold"
            style={{ borderColor: tab === t.id ? 'var(--gold)' : 'var(--line-soft)', color: tab === t.id ? 'var(--gold)' : 'var(--dim)' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'BROKER' && <BrokerTab onLoad={onLoad} />}
        {tab === 'STRATEGY_LAB' && <StrategyTab snap={snap} onLoad={onLoad} />}
        {tab === 'MANUAL' && <ManualTab onLoad={onLoad} />}
      </div>
    </div>
  );
}

function BrokerTab({ onLoad }: { onLoad: (p: LoadedPosition) => void }) {
  const [text, setText] = useState('');
  const { position, errors } = useMemo(() => parseBrokerText(text), [text]);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="text-[9px] text-[color:var(--faint)]">
        One leg per line — <span className="mono">INSTRUMENT STRIKE C|P QTY [AVG]</span> (qty in lots, − short),
        or a monthly symbol. Broker-API auto-sync is a future provider.
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
        placeholder={'BANKNIFTY 53000 P -1 180\nBANKNIFTY 55000 C -1 150\nBANKNIFTY 52000 P 1 90'}
        className="mono min-h-0 flex-1 resize-none rounded-[6px] border border-[color:var(--line)] bg-[color:var(--bg2)] p-2 text-[10px] text-[color:var(--text)] outline-none" />
      {text.trim() && (
        <div className="text-[9px]">
          {position
            ? <span className="text-[color:var(--pos)]">Detected {position.instrument} · {position.legs.length} legs</span>
            : <span className="text-[color:var(--neg)]">{errors[0]}</span>}
        </div>
      )}
      <button disabled={!position} onClick={() => position && onLoad(position)}
        className="nav-item rounded-[6px] border py-2 text-[11px] font-bold tracking-widest disabled:opacity-40"
        style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
        LOAD POSITION
      </button>
    </div>
  );
}

function StrategyTab({ snap, onLoad }: { snap: Snapshot | null; onLoad: (p: LoadedPosition) => void }) {
  const pos = useMemo(() => fromSnapshotTrade(snap), [snap]);
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="cell px-3 py-3">
        <div className="eyebrow text-[8px]">LIVE STRATEGY LAB STRUCTURE</div>
        {pos ? (
          <>
            <div className="mt-1 text-[12px] font-bold text-[color:var(--text)]">{pos.label}</div>
            <div className="mono mt-1 flex flex-wrap gap-1 text-[10px]">
              {pos.legs.map((l, i) => <span key={i} className="rounded bg-white/[0.05] px-1.5 py-0.5">{legStr(l)}</span>)}
            </div>
          </>
        ) : (
          <div className="mt-1 text-[11px] text-[color:var(--dim)]">No live structure — the engine is in NO-TRADE. Use Import or Manual.</div>
        )}
      </div>
      <button disabled={!pos} onClick={() => pos && onLoad(pos)}
        className="nav-item rounded-[6px] border py-2 text-[11px] font-bold tracking-widest disabled:opacity-40"
        style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
        OPEN THIS POSITION
      </button>
    </div>
  );
}

function ManualTab({ onLoad }: { onLoad: (p: LoadedPosition) => void }) {
  const [inst, setInst] = useState('NIFTY');
  const [kind, setKind] = useState<OptKind>('P');
  const [strike, setStrike] = useState('');
  const [qty, setQty] = useState('-1');
  const [spot, setSpot] = useState('');
  const [legs, setLegs] = useState<LoadedLeg[]>([]);

  const add = () => {
    const k = parseInt(strike, 10), q = parseInt(qty, 10);
    if (!isFinite(k) || !isFinite(q) || q === 0) return;
    setLegs((ls) => [...ls, { kind, strike: k, qty: q }]);
    setStrike('');
  };
  const build = () => legs.length && onLoad({
    instrument: inst, legs, label: `${inst} manual`, source: 'MANUAL',
    spot: spot ? Number(spot) : undefined,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5">
        <label className="cell px-2 py-1">
          <span className="eyebrow text-[7px]">INSTRUMENT</span>
          <select value={inst} onChange={(e) => setInst(e.target.value)} className="w-full bg-transparent text-[11px] font-semibold text-[color:var(--text)] outline-none">
            {INSTRUMENT_NAMES.map((n) => <option key={n} value={n} className="bg-[color:var(--bg1)]">{characteristics(n).label}</option>)}
          </select>
        </label>
        <label className="cell px-2 py-1">
          <span className="eyebrow text-[7px]">SPOT (optional)</span>
          <input value={spot} onChange={(e) => setSpot(e.target.value)} inputMode="numeric" placeholder="live/auto"
            className="mono w-full bg-transparent text-[11px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--faint)]" />
        </label>
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-1.5">
        <div className="flex rounded-[5px] border border-[color:var(--line)] p-0.5">
          {(['P', 'C'] as OptKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className="rounded-[3px] px-2 py-1 text-[10px] font-bold"
              style={{ background: kind === k ? 'var(--gold)' : 'transparent', color: kind === k ? 'var(--bg0)' : 'var(--dim)' }}>{k}</button>
          ))}
        </div>
        <input value={strike} onChange={(e) => setStrike(e.target.value)} inputMode="numeric" placeholder="strike"
          className="mono rounded-[5px] border border-[color:var(--line)] bg-[color:var(--bg2)] px-2 py-1.5 text-[11px] text-[color:var(--text)] outline-none" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="qty (lots)"
          className="mono rounded-[5px] border border-[color:var(--line)] bg-[color:var(--bg2)] px-2 py-1.5 text-[11px] text-[color:var(--text)] outline-none" />
        <button onClick={add} className="nav-item rounded-[5px] border border-[color:var(--line)] px-2.5 py-1.5 text-[11px] font-bold text-[color:var(--gold)]">+</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {legs.map((l, i) => (
          <div key={i} className="mono flex items-center justify-between border-b border-[color:var(--line-soft)] py-1 text-[10px]">
            <span className="text-[color:var(--text)]">{legStr(l)}</span>
            <button onClick={() => setLegs((ls) => ls.filter((_, j) => j !== i))} className="text-[9px] text-[color:var(--neg)]">remove</button>
          </div>
        ))}
        {!legs.length && <div className="py-3 text-center text-[10px] text-[color:var(--dim)]">Add legs to build the position.</div>}
      </div>
      <button disabled={!legs.length} onClick={build}
        className="nav-item rounded-[6px] border py-2 text-[11px] font-bold tracking-widest disabled:opacity-40"
        style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
        BUILD POSITION
      </button>
    </div>
  );
}
