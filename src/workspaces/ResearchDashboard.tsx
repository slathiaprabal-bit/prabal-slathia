import { Panel } from '../components/ui/Panel';
import { LineChart } from '../components/charts/LineChart';
import { useValidation } from '../lib/validation/useValidation';
import { useResearch } from '../lib/research/useResearch';
import { researchRecorder } from '../lib/research/recorder';
import type { ValidationReport, ValStatus } from '../lib/validation/types';
import type { ResearchBacktest } from '../lib/research/backtest';

const STATUS_COLOR: Record<ValStatus, string> = { PASS: 'var(--pos)', WARN: 'var(--gold)', FAIL: 'var(--neg)' };

// Phase 4 · M5 — Research Lab: model validation, predictive accuracy,
// calibration, rolling performance and model drift.
export function ResearchDashboard() {
  const val = useValidation();
  const res = useResearch();

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Model Validation Suite" accent="var(--pos)" className="col-start-1 col-span-5 row-start-1 row-span-4" delay={0.04}>
        {val ? <ValidationPanel report={val} /> : <Empty />}
      </Panel>

      <Panel title="Research Recorder · Model Drift" accent="var(--violet)" className="col-start-1 col-span-5 row-start-5 row-span-2" delay={0.08}>
        {res ? <RecorderDrift bt={res.backtest} rows={res.capturedRows} /> : <Empty />}
      </Panel>

      <Panel title="Predictive Accuracy · Confusion" accent="var(--info)" className="col-start-6 col-span-3 row-start-1 row-span-3" delay={0.12}>
        {res ? <ConfusionPanel bt={res.backtest} /> : <Empty />}
      </Panel>

      <Panel title="Probability Calibration" accent="var(--gold)" className="col-start-6 col-span-3 row-start-4 row-span-3" delay={0.16}>
        {res ? <CalibrationChart bt={res.backtest} /> : <Empty />}
      </Panel>

      <Panel title="Rolling Performance · Equity" accent="var(--pos)" className="col-start-9 col-span-4 row-start-1 row-span-6" delay={0.2}>
        {res ? <PerformancePanel bt={res.backtest} /> : <Empty />}
      </Panel>
    </div>
  );
}

function ValidationPanel({ report }: { report: ValidationReport }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[8px]">PASS RATE</span>
        <span className="mono text-lg font-bold" style={{ color: report.passRate >= 0.9 ? 'var(--pos)' : report.passRate >= 0.7 ? 'var(--gold)' : 'var(--neg)' }}>
          {(report.passRate * 100).toFixed(0)}%
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {report.byCategory.map((c) => (
          <span key={c.category} className="cell px-2 py-1 text-[9px]">
            <span className="text-[color:var(--dim)]">{c.category} </span>
            <span className="mono font-semibold" style={{ color: c.pass === c.total ? 'var(--pos)' : 'var(--gold)' }}>{c.pass}/{c.total}</span>
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {report.results.map((r) => (
          <div key={r.id} className="flex items-center gap-2 border-b border-[color:var(--line-soft)] py-1">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[r.status] }} />
            <span className="min-w-0 flex-1 truncate text-[10.5px] text-[color:var(--text)]">{r.label}</span>
            <span className="mono shrink-0 text-[9px] text-[color:var(--dim)]">{r.note}</span>
            <span className="w-9 shrink-0 text-right text-[8px] font-bold" style={{ color: STATUS_COLOR[r.status] }}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfusionPanel({ bt }: { bt: ResearchBacktest }) {
  if (!bt.ok) return <Empty />;
  const c = bt.confusion;
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        <Mini label="HIT RATIO" value={`${(bt.accuracy * 100).toFixed(0)}%`} color={bt.accuracy > 0.52 ? 'var(--pos)' : 'var(--gold)'} />
        <Mini label="F1" value={bt.f1.toFixed(2)} color="var(--info)" />
        <Mini label="SAMPLES" value={`${bt.samples}`} color="var(--text)" />
      </div>
      <div className="min-h-0 flex-1">
        <div className="eyebrow mb-1 text-[8px]">CONFUSION · PREDICTED × ACTUAL</div>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-px text-center text-[10px]">
          <Cell head="" /> <Cell head="ACT ↑" /> <Cell head="ACT ↓" />
          <Cell head="PRED ↑" />
          <Conf v={c.tp} good /> <Conf v={c.fp} />
          <Cell head="PRED ↓" />
          <Conf v={c.fn} /> <Conf v={c.tn} good />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Mini label="PRECISION" value={`${(bt.precision * 100).toFixed(0)}%`} color="var(--dim)" small />
          <Mini label="RECALL" value={`${(bt.recall * 100).toFixed(0)}%`} color="var(--dim)" small />
        </div>
      </div>
    </div>
  );
}

function CalibrationChart({ bt }: { bt: ResearchBacktest }) {
  if (!bt.ok || !bt.calibration.length) return <Empty />;
  const W = 200, H = 120, pad = 18;
  const sx = (v: number) => pad + v * (W - 2 * pad);
  const sy = (v: number) => H - pad - v * (H - 2 * pad);
  return (
    <div className="flex h-full flex-col">
      <div className="eyebrow mb-1 text-[8px]">PREDICTED vs REALIZED P(↑) · BRIER {bt.brier.toFixed(3)}</div>
      <div className="min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,0.1)" />
          <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="rgba(255,255,255,0.1)" />
          <polyline points={bt.calibration.map((b) => `${sx(b.predicted)},${sy(b.realized)}`).join(' ')} fill="none" stroke="var(--gold)" strokeWidth={1.5} />
          {bt.calibration.map((b, i) => <circle key={i} cx={sx(b.predicted)} cy={sy(b.realized)} r={2.5} fill="var(--gold)" />)}
          <text x={W - pad} y={H - 5} fontSize="7" fill="#5b616b" textAnchor="end">predicted →</text>
        </svg>
      </div>
      <div className="text-[8px] text-[color:var(--faint)]">Diagonal = perfect calibration; above = under-confident, below = over-confident.</div>
    </div>
  );
}

function PerformancePanel({ bt }: { bt: ResearchBacktest }) {
  if (!bt.ok) return <Empty />;
  const x = bt.equity.map((_, i) => i);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        <Mini label="SHARPE" value={bt.sharpe.toFixed(2)} color={bt.sharpe >= 1 ? 'var(--pos)' : 'var(--gold)'} />
        <Mini label="CALMAR" value={bt.calmar.toFixed(2)} color="var(--info)" />
        <Mini label="MAX DD" value={`${(bt.maxDD * 100).toFixed(1)}%`} color="var(--neg)" />
        <Mini label="TOT RET" value={`${bt.totalReturn >= 0 ? '+' : ''}${bt.totalReturn.toFixed(1)}%`} color={bt.totalReturn >= 0 ? 'var(--pos)' : 'var(--neg)'} />
      </div>
      <div className="min-h-0 flex-1">
        <div className="eyebrow mb-1 text-[8px]">STRATEGY EQUITY · DIRECTIONAL SIGNAL (base 100)</div>
        <div className="h-[calc(100%-16px)]">
          <LineChart x={x} y={bt.equity} color="#27d17c" yLabel="equity" />
        </div>
      </div>
      <div className="cell px-2.5 py-1.5">
        {bt.reasoning.map((r, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[9.5px] leading-snug">
            <span className="mt-px shrink-0 text-[color:var(--info)]">▸</span>
            <span className="text-[color:var(--dim)]">{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecorderDrift({ bt, rows }: { bt: ResearchBacktest; rows: number }) {
  const dl = (kind: 'json' | 'csv') => {
    const data = kind === 'json' ? researchRecorder.exportJSON() : researchRecorder.exportCSV();
    const blob = new Blob([data], { type: kind === 'json' ? 'application/json' : 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `volara-research.${kind}`; a.click();
    URL.revokeObjectURL(a.href);
  };
  const drift = bt.drift.psi;
  const driftColor = drift < 0.1 ? 'var(--pos)' : drift < 0.25 ? 'var(--gold)' : 'var(--neg)';
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        <Mini label="CAPTURED" value={`${rows}`} color="var(--info)" small />
        <Mini label="DRIFT PSI" value={drift.toFixed(3)} color={driftColor} small />
        <Mini label="ACC · 1ST" value={`${(bt.drift.firstHalfAcc * 100).toFixed(0)}%`} color="var(--dim)" small />
        <Mini label="ACC · 2ND" value={`${(bt.drift.secondHalfAcc * 100).toFixed(0)}%`} color="var(--dim)" small />
      </div>
      <div className="text-[10px] leading-snug text-[color:var(--dim)]">
        {drift < 0.1 ? 'No material model drift — signal distribution stable between halves.' : drift < 0.25 ? 'Minor model drift detected between halves.' : 'Significant drift — recalibration advised.'}
      </div>
      <div className="flex gap-2">
        <button onClick={() => dl('csv')} className="nav-item flex-1 rounded-[6px] border border-[color:var(--line)] py-1.5 text-[10px] font-bold tracking-widest text-[color:var(--dim)] hover:text-[color:var(--text)]">EXPORT CSV</button>
        <button onClick={() => dl('json')} className="nav-item flex-1 rounded-[6px] border border-[color:var(--line)] py-1.5 text-[10px] font-bold tracking-widest text-[color:var(--dim)] hover:text-[color:var(--text)]">EXPORT JSON</button>
      </div>
    </div>
  );
}

function Mini({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="cell flex flex-col justify-center px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className={`mono ${small ? 'text-[12px]' : 'text-[14px]'} font-bold leading-tight`} style={{ color }}>{value}</div>
    </div>
  );
}
function Cell({ head }: { head: string }) { return <div className="bg-[color:var(--panel)] px-1 py-1.5 text-[8px] font-semibold text-[color:var(--dim)]">{head}</div>; }
function Conf({ v, good }: { v: number; good?: boolean }) {
  return <div className="bg-[color:var(--panel)] px-1 py-1.5"><span className="mono text-[13px] font-bold" style={{ color: good ? 'var(--pos)' : 'var(--neg)' }}>{v}</span></div>;
}
function Empty() { return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Accumulating research data…</div>; }
