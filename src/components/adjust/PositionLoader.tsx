import { useMemo, useState, type ReactNode } from 'react';
import type { Snapshot } from '../../types';
import type { LoadedLeg, LoadedPosition, OptKind, Position } from '../../lib/adjust/types';
import { fromSnapshotTrade, parseBrokerText, buildPosition } from '../../lib/adjust/position';
import { INSTRUMENT_NAMES, characteristics, type InstrumentParams, type ExpiryOpt } from '../../lib/adjust/instruments';
import { computeMetrics } from '../../lib/adjust/metrics';
import { bs } from '../../lib/adjust/bs';
import { detectStrategy } from '../../lib/adjust/strategy';
import { useEvents } from '../../lib/events/useEvents';
import { inr, legStr } from './shared';

type Tab = 'MANUAL' | 'BROKER' | 'STRATEGY_LAB';
const TABS: { id: Tab; label: string }[] = [
  { id: 'MANUAL', label: 'Build Manually' },
  { id: 'BROKER', label: 'Import Broker' },
  { id: 'STRATEGY_LAB', label: 'Open Existing' },
];

interface StructureProps {
  params: Record<string, InstrumentParams> | null;
  expiries: Record<string, ExpiryOpt[]>;
  degraded: boolean;
}

export function PositionLoader({ snap, params, expiries, degraded, onLoad }: StructureProps & {
  snap: Snapshot | null; onLoad: (p: LoadedPosition) => void;
}) {
  const [tab, setTab] = useState<Tab>('MANUAL');
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-bold text-[color:var(--text)]">Position Builder</div>
          <div className="text-[10px] text-[color:var(--dim)]">
            Every Greek, margin, breakeven and recommendation is computed from the exact position you build — no demo data.
          </div>
        </div>
        {degraded && <span className="rounded-[4px] px-1.5 py-px text-[8px] font-bold tracking-wider text-[color:var(--gold)]"
          style={{ background: 'color-mix(in srgb, var(--gold) 13%, transparent)' }}>MARKET STRUCTURE: FALLBACK</span>}
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
        {tab === 'MANUAL' && <ManualTab params={params} expiries={expiries} snap={snap} onLoad={onLoad} />}
        {tab === 'BROKER' && <BrokerTab onLoad={onLoad} />}
        {tab === 'STRATEGY_LAB' && <StrategyTab snap={snap} onLoad={onLoad} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 3 — the full multi-leg builder + live position summary.
// ─────────────────────────────────────────────────────────────────────────────

type Side = 'BUY' | 'SELL';

function ManualTab({ params, expiries, snap, onLoad }: {
  params: Record<string, InstrumentParams> | null; expiries: Record<string, ExpiryOpt[]>;
  snap: Snapshot | null; onLoad: (p: LoadedPosition) => void;
}) {
  const [inst, setInst] = useState('NIFTY');
  const [spot, setSpot] = useState('');
  const [legs, setLegs] = useState<LoadedLeg[]>([]);

  // Draft-leg form.
  const [side, setSide] = useState<Side>('SELL');
  const [kind, setKind] = useState<OptKind>('P');
  const [strikeStr, setStrikeStr] = useState('');
  const [lotsStr, setLotsStr] = useState('1');
  const [entryStr, setEntryStr] = useState('');
  const [legExpiry, setLegExpiry] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const instExpiries = expiries[inst] ?? [];
  const iparams = params?.[inst] ?? null;
  const step = iparams?.strikeStep ?? 0;

  // Default the leg-expiry selector to the instrument's nearest expiry.
  const effLegExpiry = legExpiry || instExpiries[0]?.date || '';

  // Position-level front expiry drives DTE / weekly-expiry info in the summary.
  const frontExpiry = useMemo(() => {
    const dates = legs.map((l) => l.expiry).filter(Boolean) as string[];
    const pool = dates.length ? instExpiries.filter((e) => dates.includes(e.date)) : instExpiries;
    return pool.slice().sort((a, b) => a.dte - b.dte)[0] ?? instExpiries[0] ?? null;
  }, [legs, instExpiries]);

  // Draft validation — blocking errors + non-blocking warnings.
  const draft = useMemo(() => {
    const errors: string[] = [], warnings: string[] = [];
    const k = Number(strikeStr), lots = Number(lotsStr), entry = Number(entryStr);
    if (!strikeStr.trim() || !isFinite(k) || k <= 0) errors.push('Enter a valid strike price.');
    else if (step > 0 && k % step !== 0) warnings.push(`${inst} strikes are ${step}-point spaced — ${k} is off the grid.`);
    if (!lotsStr.trim() || !isFinite(lots) || lots <= 0 || !Number.isInteger(lots))
      errors.push('Enter quantity as a whole number of lots (greater than 0).');
    if (entryStr.trim() && (!isFinite(entry) || entry < 0)) errors.push('Avg entry price must be a positive number, or left blank.');
    if (!effLegExpiry) errors.push('Select an expiry for this leg.');
    return { errors, warnings, k, lots, entry };
  }, [strikeStr, lotsStr, entryStr, effLegExpiry, step, inst]);

  const resetDraft = () => { setStrikeStr(''); setEntryStr(''); setEditIdx(null); };

  const commitLeg = () => {
    if (draft.errors.length) return;
    const leg: LoadedLeg = {
      kind, strike: draft.k, qty: side === 'SELL' ? -draft.lots : draft.lots,
      entry: entryStr.trim() ? draft.entry : undefined, expiry: effLegExpiry,
    };
    setLegs((ls) => {
      if (editIdx == null) return [...ls, leg];
      const cp = ls.slice(); cp[editIdx] = leg; return cp;
    });
    resetDraft();
  };

  const editLeg = (i: number) => {
    const l = legs[i];
    setSide(l.qty < 0 ? 'SELL' : 'BUY'); setKind(l.kind);
    setStrikeStr(String(l.strike)); setLotsStr(String(Math.abs(l.qty)));
    setEntryStr(l.entry != null ? String(l.entry) : ''); setLegExpiry(l.expiry ?? effLegExpiry);
    setEditIdx(i);
  };
  const dupLeg = (i: number) => setLegs((ls) => [...ls.slice(0, i + 1), { ...ls[i] }, ...ls.slice(i + 1)]);
  const delLeg = (i: number) => setLegs((ls) => ls.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => setLegs((ls) => {
    const j = i + d; if (j < 0 || j >= ls.length) return ls;
    const cp = ls.slice(); [cp[i], cp[j]] = [cp[j], cp[i]]; return cp;
  });

  const detected = detectStrategy(legs);
  const canBuild = legs.length > 0;
  const build = () => {
    if (!canBuild) return;
    onLoad({
      instrument: inst, legs, label: detected.name, source: 'MANUAL',
      spot: spot.trim() ? Number(spot) : undefined,
    });
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[1.15fr_1fr] gap-3">
      {/* LEFT — builder */}
      <div className="flex min-h-0 flex-col gap-2">
        {/* position-level fields */}
        <div className="grid grid-cols-3 gap-1.5">
          <label className="cell px-2 py-1">
            <span className="eyebrow text-[7px]">INSTRUMENT</span>
            <select value={inst} onChange={(e) => { setInst(e.target.value); setLegExpiry(''); }}
              className="w-full bg-transparent text-[11px] font-semibold text-[color:var(--text)] outline-none">
              {INSTRUMENT_NAMES.map((n) => <option key={n} value={n} className="bg-[color:var(--bg1)]">{characteristics(n).label}</option>)}
            </select>
          </label>
          <label className="cell px-2 py-1">
            <span className="eyebrow text-[7px]">UNDERLYING SPOT</span>
            <input value={spot} onChange={(e) => setSpot(e.target.value)} inputMode="decimal" placeholder="live / auto"
              className="mono w-full bg-transparent text-[11px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--faint)]" />
          </label>
          <label className="cell px-2 py-1">
            <span className="eyebrow text-[7px]">STRUCTURE</span>
            <span className="mono block truncate text-[11px] font-semibold text-[color:var(--gold)]">{legs.length ? detected.name : '—'}</span>
          </label>
        </div>

        {/* draft-leg entry */}
        <div className="rounded-[7px] border border-[color:var(--line-soft)] p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="eyebrow text-[7.5px]">{editIdx == null ? 'ADD LEG' : `EDIT LEG #${editIdx + 1}`}</span>
            {editIdx != null && <button onClick={resetDraft} className="text-[8.5px] font-bold tracking-wider text-[color:var(--dim)]">CANCEL EDIT</button>}
          </div>
          <div className="grid grid-cols-[auto_auto_1fr_1fr] items-end gap-1.5">
            <Toggle options={['BUY', 'SELL']} value={side} onChange={(v) => setSide(v as Side)}
              colors={{ BUY: 'var(--pos)', SELL: 'var(--neg)' }} label="SIDE" />
            <Toggle options={['C', 'P']} value={kind} onChange={(v) => setKind(v as OptKind)}
              colors={{ C: 'var(--gold)', P: 'var(--info)' }} label="TYPE" />
            <Field label="STRIKE">
              <input value={strikeStr} onChange={(e) => setStrikeStr(e.target.value)} inputMode="numeric" placeholder="strike"
                className="mono w-full bg-transparent text-[11px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--faint)]" />
            </Field>
            <Field label="EXPIRY">
              <select value={effLegExpiry} onChange={(e) => setLegExpiry(e.target.value)}
                className="w-full bg-transparent text-[10px] font-semibold text-[color:var(--text)] outline-none disabled:text-[color:var(--faint)]"
                disabled={!instExpiries.length}>
                {instExpiries.length
                  ? instExpiries.map((e) => <option key={e.date} value={e.date} className="bg-[color:var(--bg1)]">{e.label}</option>)
                  : <option value="">no live expiries</option>}
              </select>
            </Field>
          </div>
          <div className="mt-1.5 grid grid-cols-[1fr_1fr_auto] items-end gap-1.5">
            <Field label="QUANTITY (LOTS)">
              <input value={lotsStr} onChange={(e) => setLotsStr(e.target.value)} inputMode="numeric" placeholder="lots"
                className="mono w-full bg-transparent text-[11px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--faint)]" />
            </Field>
            <Field label="AVG ENTRY (OPT)">
              <input value={entryStr} onChange={(e) => setEntryStr(e.target.value)} inputMode="decimal" placeholder="fill price"
                className="mono w-full bg-transparent text-[11px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--faint)]" />
            </Field>
            <button onClick={commitLeg}
              className="nav-item rounded-[6px] border px-3 py-2 text-[11px] font-bold tracking-wider"
              style={{ borderColor: draft.errors.length ? 'var(--line)' : 'var(--gold)', color: draft.errors.length ? 'var(--dim)' : 'var(--gold)' }}>
              {editIdx == null ? '+ ADD' : 'UPDATE'}
            </button>
          </div>
          {/* validation — never silently blocked; always say what is missing */}
          {(draft.errors.length > 0 || draft.warnings.length > 0) && (strikeStr.trim() !== '' || lotsStr.trim() !== '' || editIdx != null) && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              {draft.errors.map((e, i) => <div key={`e${i}`} className="text-[9px] text-[color:var(--neg)]">• {e}</div>)}
              {draft.warnings.map((w, i) => <div key={`w${i}`} className="text-[9px] text-[color:var(--gold)]">• {w}</div>)}
            </div>
          )}
        </div>

        {/* legs table */}
        <div className="min-h-0 flex-1 overflow-auto rounded-[7px] border border-[color:var(--line-soft)]">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-[color:var(--bg1)]">
              <tr className="text-[7.5px] tracking-wider text-[color:var(--faint)]">
                {['#', 'SIDE', 'TYPE', 'STRIKE', 'EXPIRY', 'LOTS', 'AVG', ''].map((h) => (
                  <th key={h} className="border-b border-[color:var(--line-soft)] px-1.5 py-1 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="mono">
              {legs.map((l, i) => (
                <tr key={i} className="border-b border-[color:var(--line-soft)] hover:bg-white/[0.03]">
                  <td className="px-1.5 py-1 text-[color:var(--faint)]">{i + 1}</td>
                  <td className="px-1.5 py-1 font-bold" style={{ color: l.qty < 0 ? 'var(--neg)' : 'var(--pos)' }}>{l.qty < 0 ? 'SELL' : 'BUY'}</td>
                  <td className="px-1.5 py-1" style={{ color: l.kind === 'C' ? 'var(--gold)' : 'var(--info)' }}>{l.kind === 'C' ? 'CALL' : 'PUT'}</td>
                  <td className="px-1.5 py-1 text-[color:var(--text)]">{l.strike}</td>
                  <td className="px-1.5 py-1 text-[color:var(--dim)]">{expLabelShort(l.expiry, instExpiries)}</td>
                  <td className="px-1.5 py-1 text-[color:var(--text)]">{Math.abs(l.qty)}</td>
                  <td className="px-1.5 py-1 text-[color:var(--dim)]">{l.entry != null ? l.entry : '—'}</td>
                  <td className="px-1 py-1">
                    <div className="flex items-center justify-end gap-1 text-[8.5px] font-bold">
                      <IconBtn title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</IconBtn>
                      <IconBtn title="Move down" onClick={() => move(i, 1)} disabled={i === legs.length - 1}>↓</IconBtn>
                      <IconBtn title="Edit" onClick={() => editLeg(i)} color="var(--gold)">edit</IconBtn>
                      <IconBtn title="Duplicate" onClick={() => dupLeg(i)} color="var(--info)">dup</IconBtn>
                      <IconBtn title="Delete" onClick={() => delLeg(i)} color="var(--neg)">del</IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {!legs.length && (
                <tr><td colSpan={8} className="px-2 py-6 text-center text-[10px] text-[color:var(--dim)]">
                  No legs yet. Set Side · Type · Strike · Expiry · Lots above, then <span className="text-[color:var(--gold)]">+ ADD</span>.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* build */}
        {!canBuild && <div className="text-[9px] text-[color:var(--neg)]">• Add at least one leg — a position needs one or more legs before it can be built.</div>}
        <button onClick={build}
          className="nav-item rounded-[6px] border py-2 text-[11px] font-bold tracking-widest"
          style={{ borderColor: canBuild ? 'var(--gold)' : 'var(--line)', color: canBuild ? 'var(--gold)' : 'var(--dim)',
            background: canBuild ? 'color-mix(in srgb, var(--gold) 10%, transparent)' : undefined }}>
          BUILD POSITION → RUN ADJUSTMENT ENGINE
        </button>
      </div>

      {/* RIGHT — live summary */}
      <div className="min-h-0 overflow-auto rounded-[7px] border border-[color:var(--line-soft)] bg-[color:var(--bg1)] p-2.5">
        <LiveSummary inst={inst} legs={legs} spotStr={spot} params={iparams} front={frontExpiry} snap={snap} detected={detected} />
      </div>
    </div>
  );
}

// Live, pre-build position summary — recomputed on every leg change.
function LiveSummary({ inst, legs, spotStr, params, front, snap, detected }: {
  inst: string; legs: LoadedLeg[]; spotStr: string; params: InstrumentParams | null;
  front: ExpiryOpt | null; snap: Snapshot | null; detected: { name: string; legCount: number };
}) {
  const { events } = useEvents();
  const dte = front?.dte ?? params?.dte ?? 7;

  const pos: Position | null = useMemo(() => {
    if (!params || legs.length === 0) return null;
    const loaded: LoadedPosition = {
      instrument: inst, legs, label: detected.name, source: 'MANUAL',
      spot: spotStr.trim() ? Number(spotStr) : undefined,
    };
    return buildPosition(loaded, params, snap, dte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst, legs, params, spotStr, dte, snap]);

  const m = useMemo(() => (pos ? computeMetrics(pos.legs, [], pos) : null), [pos]);

  // Net credit/debit — from avg entries when present, else theoretical marks.
  const cashflow = useMemo(() => {
    if (!pos) return null;
    let net = 0, theoretical = false;
    for (const l of legs) {
      let px = l.entry;
      if (px == null) { theoretical = true; px = bs(pos.spot, l.strike, pos.dte / 365, pos.iv, pos.rate, l.kind).price; }
      net += -l.qty * pos.lotSize * px;
    }
    return { net, theoretical };
  }, [pos, legs]);

  const upcoming = useMemo(() => {
    const horizon = dte * 86400000;
    return events.filter((e) => e.status !== 'COMPLETED' && e.msUntil != null && e.msUntil > 0 && e.msUntil <= horizon).slice(0, 4);
  }, [events, dte]);

  if (!pos || !m) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <div className="eyebrow text-[8px]">LIVE POSITION SUMMARY</div>
        <div className="text-[10px] text-[color:var(--dim)]">
          {params ? 'Add a leg to see the detected strategy, Greeks, margin, breakevens and POP compute live.'
                  : 'Loading market structure…'}
        </div>
      </div>
    );
  }

  const ch = characteristics(inst);
  const em = Math.round(pos.spot * pos.iv * Math.sqrt(pos.dte / 365));
  const dcol = (v: number) => (v >= 0 ? 'var(--pos)' : 'var(--neg)');

  return (
    <div className="flex flex-col gap-2">
      {/* detected strategy header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow text-[7px]">DETECTED STRATEGY</div>
          <div className="text-[13px] font-bold text-[color:var(--gold)]">{detected.name}</div>
        </div>
        <span className="rounded-[4px] px-1.5 py-px text-[8px] font-bold tracking-wider text-[color:var(--dim)]"
          style={{ background: 'rgba(255,255,255,0.05)' }}>{detected.legCount} LEG{detected.legCount === 1 ? '' : 'S'}</span>
      </div>

      <div className="text-[8px] tracking-wider text-[color:var(--faint)]">
        {ch.label} · {pos.exchange} · lot {pos.lotSize} · step {pos.strikeStep} · {ch.liquidity} liquidity
      </div>

      <div className="mono flex flex-wrap gap-1 text-[9.5px]">
        {pos.legs.map((l, i) => <span key={i} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[color:var(--text)]">{legStr(l)}</span>)}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="UNDERLYING" value={pos.spot.toLocaleString('en-IN')} />
        <Stat label={cashflow && cashflow.net >= 0 ? 'NET CREDIT' : 'NET DEBIT'}
          value={cashflow ? inr(Math.abs(cashflow.net)) : '—'}
          hint={cashflow?.theoretical ? 'theoretical' : 'from fills'}
          color={cashflow && cashflow.net >= 0 ? 'var(--pos)' : 'var(--neg)'} />
        <Stat label="MARGIN" value={inr(m.margin)} />
        <Stat label="MAX PROFIT" value={inr(m.maxProfit)} color="var(--pos)" />
        <Stat label="MAX LOSS" value={inr(m.maxLoss)} color="var(--neg)" />
        <Stat label="POP" value={`${(m.pop * 100).toFixed(0)}%`} color={m.pop >= 0.6 ? 'var(--pos)' : 'var(--gold)'} />
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="DELTA" value={m.delta.toFixed(0)} color={dcol(m.delta)} />
        <Stat label="GAMMA" value={m.gamma.toFixed(3)} />
        <Stat label="THETA" value={`${inr(m.theta)}`} color={dcol(m.theta)} />
        <Stat label="VEGA" value={inr(m.vega)} color={dcol(m.vega)} />
      </div>

      <div className="cell px-2 py-1.5">
        <div className="eyebrow text-[7px]">BREAKEVEN{m.breakevens.length === 1 ? '' : 'S'}</div>
        <div className="mono text-[11px] font-bold text-[color:var(--text)]">
          {m.breakevens.length ? m.breakevens.map((b) => b.toLocaleString('en-IN')).join('  ·  ') : 'none in scan range'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="CURRENT IV" value={`${(pos.iv * 100).toFixed(1)}%`} />
        <Stat label="IV RANK" value={pos.ivRank.toFixed(0)} color={pos.ivRank >= 65 ? 'var(--neg)' : pos.ivRank <= 30 ? 'var(--pos)' : 'var(--text)'} />
        <Stat label="EXP. MOVE" value={`±${em.toLocaleString('en-IN')}`} />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="cell px-2 py-1.5">
          <div className="eyebrow text-[7px]">MARKET REGIME</div>
          <div className="text-[10px] font-bold text-[color:var(--gold)]">{pos.regime.replace(/_/g, ' ')}</div>
        </div>
        <div className="cell px-2 py-1.5">
          <div className="eyebrow text-[7px]">EXPIRY · DTE</div>
          <div className="mono text-[10px] font-bold text-[color:var(--text)]">
            {front ? `${front.label.split(' · ')[0]} · ${front.kind === 'MONTHLY' ? 'Monthly' : 'Weekly'} · ${pos.dte}d` : `${pos.dte}d`}
          </div>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-1 text-[7.5px]">UPCOMING MACRO EVENTS · WITHIN DTE</div>
        {upcoming.length ? (
          <div className="flex flex-col gap-0.5">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-[9.5px]">
                <span className="truncate text-[color:var(--dim)]">{e.name}</span>
                <span className="mono shrink-0 text-[color:var(--text)]">{e.countdown}</span>
              </div>
            ))}
          </div>
        ) : <div className="text-[9px] text-[color:var(--faint)]">No scheduled events before expiry.</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 1 — broker import.
// ─────────────────────────────────────────────────────────────────────────────

function BrokerTab({ onLoad }: { onLoad: (p: LoadedPosition) => void }) {
  const [text, setText] = useState('');
  const { position, errors } = useMemo(() => parseBrokerText(text), [text]);
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col gap-2">
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

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 2 — open the live Strategy Lab structure.
// ─────────────────────────────────────────────────────────────────────────────

function StrategyTab({ snap, onLoad }: { snap: Snapshot | null; onLoad: (p: LoadedPosition) => void }) {
  const pos = useMemo(() => fromSnapshotTrade(snap), [snap]);
  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col justify-center gap-3">
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
          <div className="mt-1 text-[11px] text-[color:var(--dim)]">No live structure — the engine is in NO-TRADE. Use Import or Build Manually.</div>
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

// ── small UI atoms ──

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 rounded-[5px] border border-[color:var(--line)] bg-[color:var(--bg2)] px-2 py-1">
      <span className="eyebrow text-[6.5px]">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ options, value, onChange, colors, label }: {
  options: string[]; value: string; onChange: (v: string) => void; colors: Record<string, string>; label: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow text-[6.5px] text-[color:var(--faint)]">{label}</span>
      <div className="flex rounded-[5px] border border-[color:var(--line)] p-0.5">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} className="rounded-[3px] px-2 py-1 text-[10px] font-bold"
            style={{ background: value === o ? colors[o] : 'transparent', color: value === o ? 'var(--bg0)' : 'var(--dim)' }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, color, title, disabled }: {
  children: ReactNode; onClick: () => void; color?: string; title: string; disabled?: boolean;
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className="rounded px-1 py-0.5 hover:bg-white/[0.06] disabled:opacity-25"
      style={{ color: color ?? 'var(--dim)' }}>{children}</button>
  );
}

function Stat({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div className="cell px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className="mono text-[12px] font-bold leading-tight" style={{ color: color ?? 'var(--text)' }}>{value}</div>
      {hint && <div className="text-[6.5px] text-[color:var(--faint)]">{hint}</div>}
    </div>
  );
}

// Short expiry label for the table (from the loaded expiry ladder).
function expLabelShort(date: string | undefined, exps: ExpiryOpt[]): string {
  if (!date) return 'front';
  const e = exps.find((x) => x.date === date);
  return e ? e.label.split(' · ')[0] : date.slice(5);
}
