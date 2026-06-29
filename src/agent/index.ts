// ════════════════════════════════════════════════════════════════════════
//  AI Trading Research Agent — public surface
//  An independent subsystem that runs a hedge-fund-style research process over
//  market data. VOLARA is a data provider only (see provider.ts). The agent
//  never emits a bare buy/sell signal — it produces a graded, gated, sized,
//  self-critiquing ResearchNote and learns from prior outcomes.
// ════════════════════════════════════════════════════════════════════════

export type * from './types';
export { research } from './agent';
export { contextFromSnapshot } from './provider';
export { readRegime } from './regime';
export { formThesis } from './thesis';
export { gatherEvidence } from './evidence';
export { runPreMortem } from './premortem';
export { runGates, hasBlock, cautionCount } from './gates';
export { scoreConviction, sizePosition } from './conviction';
export {
  loadMemory, recordNote, recordOutcome, statsFor, allStats, resetMemory, setPersist,
  type MemoryStore,
} from './memory';
export { useAgent, type AgentView } from './useAgent';
