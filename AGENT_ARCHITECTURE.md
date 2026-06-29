# AI Trading Research Agent — Architecture & Design Charter

**Status:** Proposed for agreement · v0.1 · 2026-06-29
**Purpose:** The single source of truth for *what this system is, how its parts
communicate, what each part owns, and how it grows from MVP to a
production-grade research agent.* No further feature code is written until this
is agreed.

This document supersedes nothing in VOLARA. The Research Agent is a **separate
system** that happens to live in the same repository under `src/agent/`. VOLARA
is a **data provider only**.

---

## 0. How to read this document

- **§1 Principles** are *permanent law*. Every design decision must be
  justifiable against them. If a future feature conflicts with a principle, the
  feature changes, not the principle.
- **§2–§9** describe the target architecture: layers, data contracts, ownership,
  and the knowledge subsystem (the differentiator).
- **§10–§12** cover layout, roadmap, and explicit non-goals.
- **§13** lists the open questions we should resolve together before coding.
- Modules marked **[built]** exist today; **[planned]** are designed here but not
  yet implemented; **[future]** are placeholders with defined seams only.

---

## 1. Permanent design principles (governing law)

> These are inviolable. They are restated here verbatim as the contract.

**P1 — Independence.** This project is an independent Research Agent. It is
**never** merged into VOLARA. VOLARA is only a data provider. *Implication:* the
agent imports nothing from VOLARA except through a single adapter seam
(`provider.ts`); it never reads VOLARA's signals, decision logic, or internals.

**P2 — Judgement, not signals.** The goal is not random buy/sell signals. The
agent must think like an experienced **discretionary trader**. *Implication:*
the output is a reasoned *research note* (thesis → evidence → risk → verdict),
and the system is deliberately **hard to convince** — doing nothing is a
first-class outcome.

**P3 — Always explainable.** Every conclusion must carry its **evidence,
assumptions, invalidation points, and confidence**. *Implication:* there is a
mandatory data shape (`Reasoned<T>`, §6) that *every* intermediate conclusion
conforms to. Nothing is a black box, including any future LLM step.

**P4 — Experience is first-class knowledge.** The trader's observations are
encoded as **first-class knowledge objects**, not as technical indicators. They
carry provenance, scope, confidence, invalidation, and their own track record.
*Implication:* there is a dedicated **Knowledge layer** (§5) that participates in
reasoning on equal footing with structural perception.

**P5 — No indicator engine.** RSI / MACD / EMA-crossover logic must **never**
become the core. Dominant inputs are **price structure, market behaviour,
positioning, volatility, liquidity, and experience.** *Implication:* the
evidence layer is built from behavioural/structural readers and knowledge, not
oscillator math. (Indicators, if ever used, are demoted to weak corroborating
context at most — never a driver.)

**P6 — Modular for growth.** Everything is modular so we can later add: chart
vision, memory of past situations, trade-journal learning, live news/macro
reasoning, an optional LLM reasoning layer, and automated research workflows.
*Implication:* each of those is a **plug-in at a defined seam** (§9), requiring
no change to the reasoning core.

---

## 2. System overview

The agent is a **layered pipeline with a feedback loop**. Data flows upward
through interpretation into a reasoned decision; outcomes flow back down as
learning. Every layer talks to its neighbours through typed contracts only.

```
                       ┌──────────────────────────────────────────┐
                       │            PRESENTATION (UI)              │  React workspace
                       └───────────────▲──────────────────────────┘
                                       │ ResearchNote (read-only)
┌──────────────────────────────────────┴──────────────────────────────────────┐
│                              ORCHESTRATION                                    │
│         pipeline runner · research workflows · scheduling [future]           │
└───▲───────────────────────────────────────────────────────────────────┬─────┘
    │ reasoned conclusions                                               │ feedback
┌───┴───────────────────────────────────────────────────────────────────▼─────┐
│  REASONING        thesis · evidence(confluence) · pre-mortem · gates ·        │
│                   conviction · sizing · verdict                               │
│                          ▲                         ▲                          │
│        structural facts  │                         │  knowledge matches       │
└──────────────────────────┼─────────────────────────┼─────────────────────────┘
        ┌──────────────────┴───────┐      ┌──────────┴───────────────────┐
        │       PERCEPTION         │      │        KNOWLEDGE             │
        │ regime · structure ·     │      │ trader observations (KB) ·   │
        │ levels · liquidity ·     │      │ matcher · reliability track  │
        │ positioning · vol state  │      │  (experience = first-class)  │
        └──────────────▲───────────┘      └──────────────▲───────────────┘
                       │ MarketContext (canonical truth)  │
        ┌──────────────┴──────────────────────────────────┴──────────────┐
        │                         CONTEXT                                 │
        │     assembly · normalisation · data-quality tagging             │
        └──────────────▲──────────────────────────────────────────────────┘
                       │ adapters
        ┌──────────────┴──────────────────────────────────────────────────┐
        │   DATA PROVIDERS:  VOLARA[built] · chart-vision[future] ·         │
        │                    news/macro[future] · manual input[future]     │
        └──────────────────────────────────────────────────────────────────┘
                       ▲
        ┌──────────────┴───────────────┐        ┌─────────────────────────┐
        │   MEMORY (history & priors)  │◀──────▶│  PERSISTENCE (injectable)│
        │ outcomes · setup stats ·     │        │  localStorage → SQLite/  │
        │ situation memory[future] ·   │        │  VOLARA-backed           │
        │ journal learning[future]     │        └─────────────────────────┘
        └──────────────────────────────┘
```

**Two laws of flow:**
1. **Upward only** for reasoning — a layer may consume the contract of the layer
   below, never reach around it. (e.g. Reasoning never reads a VOLARA Snapshot;
   it reads `MarketContext` + Perception + Knowledge.)
2. **Feedback is explicit** — Memory is the *only* path by which the past
   influences the present, and it does so through declared priors, not hidden
   state.

---

## 3. The layers in detail

### 3.1 Data Provider layer — *owns raw external data → adapters*
- **Responsibility:** turn each external source into a partial contribution to
  `MarketContext`. Nothing here interprets the market.
- **Modules:** `provider.ts` (VOLARA Snapshot → MarketContext) **[built]**;
  `providers/chartVision.ts` **[future]**; `providers/news.ts` **[future]**;
  `providers/manual.ts` (trader types in a context) **[future]**.
- **Owns:** the *mapping* from a source schema to context fields, and the
  honesty flags (`dataLive`, `chainSynthetic`, per-field provenance).
- **Rule (P1):** this is the **only** place VOLARA types are imported.

### 3.2 Context layer — *owns the canonical "what is true now"*
- **Responsibility:** assemble provider outputs into one normalised, validated
  `MarketContext`; tag data quality; resolve units/conventions.
- **Modules:** `context.ts` **[planned]** (today `provider.ts` does both; we
  split assembly from adaptation when >1 provider exists).
- **Owns:** `MarketContext` (the contract every higher layer consumes).
- **Rule:** higher layers may read context but never mutate it.

### 3.3 Perception layer — *owns market interpretation (no indicators)*
- **Responsibility:** read context into **behavioural/structural facts**: the
  regime/character, key price-structure levels (support/resistance, value area,
  prior-day/where-liquidity-sits), volatility state, dealer positioning,
  liquidity condition. Each fact is a `Reasoned<Fact>` (§6).
- **Modules:** `regime.ts` **[built]**; `perception/structure.ts` **[planned]**
  (levels, swing points, ranges); `perception/liquidity.ts` **[planned]**;
  `perception/positioning.ts` **[planned]** (PCR/max-pain/gamma read);
  `perception/volState.ts` **[planned]**.
- **Owns:** `RegimeRead` **[built]** and the future `MarketFacts` bundle.
- **Rule (P5):** facts describe **behaviour and structure**, e.g. *"spot is
  pinned at the value area"*, *"thin liquidity above 25,000"* — never *"RSI 70"*.

### 3.4 Knowledge layer — *owns the trader's encoded experience* — see §5
- **Responsibility:** store the trader's observations as first-class objects;
  match active observations against the current context + perception; emit
  knowledge contributions (evidence/cautions/biases) **with provenance**; track
  each observation's real-world reliability.
- **Modules:** `knowledge/types.ts`, `knowledge/store.ts`, `knowledge/match.ts`,
  `knowledge/predicates.ts` **[planned]**.
- **Owns:** the `Observation` corpus and its reliability stats.

### 3.5 Reasoning layer — *owns the deliberation*
- **Responsibility:** the discretionary process. Form a thesis; gather
  confluence from **structural collectors + knowledge matches**; run a
  pre-mortem; apply capital-preservation gates; score conviction; size; decide a
  verdict.
- **Modules:** `thesis.ts`, `evidence.ts`, `premortem.ts`, `gates.ts`,
  `conviction.ts`, `agent.ts` **[all built]**. `evidence.ts` will gain a
  `knowledgeEvidence` source **[planned]** so experience enters confluence as a
  peer of structure.
- **Owns:** `Thesis`, `EvidenceItem`, `PreMortem`, `RiskGate`, `Conviction`,
  `Sizing`, `Verdict`, and the assembled `ResearchNote`.
- **Rule (P2):** the verdict is the *end of a deliberation*; `STAND_ASIDE` is a
  success, not a failure.

### 3.6 Memory layer — *owns history & learned priors*
- **Responsibility:** record each note and its resolved outcome; compute
  Beta-smoothed, confidence-discounted edge per setup; (future) store full
  *situations* for nearest-neighbour recall and ingest the trade journal.
- **Modules:** `memory.ts` **[built]**; `memory/situations.ts` **[future]**;
  `memory/journal.ts` **[future]**.
- **Owns:** `OutcomeRecord`, `SetupStats`, situation index, journal-derived
  lessons. Feeds **only** the conviction step and (future) knowledge reliability.

### 3.7 Narrative / Explainability layer — *owns presentation of reasoning*
- **Responsibility:** assemble the human-readable reasoning trace; optionally
  render it into prose via an LLM **that only narrates, never decides**.
- **Modules:** narrative builder inside `agent.ts` **[built]**;
  `narrative/llm.ts` **[future]**.
- **Rule (P3):** the LLM receives the *already-decided* reasoned objects and may
  not alter conviction, gates, or verdict.

### 3.8 Orchestration layer — *owns running the pipeline & workflows*
- **Responsibility:** run a single deliberation (`research()`); schedule
  recurring research; chain multi-step *research workflows* (future).
- **Modules:** `agent.research()` **[built]**; `orchestration/workflows.ts`,
  `orchestration/schedule.ts` **[future]**.

### 3.9 Presentation layer — *owns UI only*
- **Modules:** `workspaces/ResearchAgent.tsx`, `components/agent/*` **[built]**,
  `useAgent.ts` **[built]**.
- **Rule:** UI consumes `ResearchNote` read-only and may write only *outcomes*
  and *observations* back through declared APIs.

### 3.10 Persistence layer — *owns durable storage, injectable*
- **Modules:** `setPersist()` in `memory.ts` **[built]** (localStorage default).
- **Rule:** swap to SQLite/VOLARA-backed storage without touching reasoning.

---

## 4. Core data contracts

These are the *interfaces between layers*. Changing one is an architectural
decision; adding fields is cheap, repurposing them is not.

- **`MarketContext`** **[built]** — the canonical normalised market read (the
  provider boundary). Owned by Context. *The agent's entire view of the world.*
- **`Reasoned<T>`** **[planned]** — the explainability envelope (§6). Every fact,
  evidence item, thesis, and gate is wrapped in it.
- **`Observation`** **[planned]** — one piece of encoded trader experience (§5).
- **`EvidenceItem`** **[built]** — a single confluence contribution
  (`align`, `weight`, `detail`); will carry a `source: 'structure' | 'knowledge'`
  and provenance.
- **`ResearchNote`** **[built]** — the deliverable: regime, thesis, evidence,
  pre-mortem, gates, conviction, sizing, verdict, narrative, trigger.
- **`OutcomeRecord` / `SetupStats`** **[built]** — the learning records.

---

## 5. The Knowledge subsystem (P4 + P5) — the differentiator

This is what makes the agent *yours* rather than generic. The trader's
experience is captured as structured, accountable **Observations** that reason
alongside structural perception — never reduced to indicator math.

### 5.1 What an Observation is

A first-class object describing *a thing you have learned about how the market
behaves*, in your own terms.

```ts
interface Observation {
  id: string;
  provenance: { author: string; createdAt: string; source: 'trader' | 'journal' | 'review' };
  title: string;                 // "Failed breakout above prior-day high"
  statement: string;             // plain-language experience, the way you'd say it

  // WHEN it applies — declarative, BEHAVIOURAL conditions (never an indicator formula)
  scope: {
    regimes?: MarketCharacter[];           // e.g. ['RANGE','COMPRESSION']
    structures?: Structure[];
    instruments?: string[];
    session?: ('open' | 'mid' | 'close')[];
    conditions: Predicate[];               // from a fixed behavioural vocabulary, §5.2
  };

  // WHAT it implies — where it pushes the deliberation
  implication: {
    target: 'thesis' | 'evidence' | 'gate' | 'sizing';
    stanceBias?: Stance;                   // optional directional lean
    structureBias?: Structure;
    align?: number;                        // -1..+1 push on the working thesis
    weight: number;                        // importance, 0..1
    action?: 'favor' | 'caution' | 'block';// for gate-targeted observations
  };

  confidence: number;            // YOUR stated confidence, 0..1
  invalidation: string;          // when this stops being true / what disproves it
  tags: string[];
  status: 'active' | 'testing' | 'retired';

  // LEARNED reliability — does this observation actually pay? (filled by Memory)
  track: { applied: number; correct: number; edge: number; lastReviewed?: string };
}
```

### 5.2 The behavioural predicate vocabulary (enforces P5)

Conditions are composed from a **fixed, declarative vocabulary** over
`MarketContext` + Perception facts — all structural/behavioural, none of them
oscillators:

- **Structure:** `at_level(support|resistance|value_area)`, `breakout(level)`,
  `failed_breakout(level)`, `inside_range`, `gap_open(>x%)`, `prior_day_high/low`.
- **Positioning:** `pcr_extreme(side)`, `pinned_at_max_pain`,
  `dealer_gamma(positive|negative)`, `oi_wall(near)`.
- **Volatility:** `vol_state(compressed|normal|elevated|expanding)`,
  `vrp(rich|cheap)`, `vol_spike`.
- **Liquidity:** `thin_liquidity(direction)`, `into_liquidity_pool`.
- **Behaviour/Session:** `session(open|mid|close)`, `trend_day`, `first_hour`,
  `range_compression`, `failed_auction`.

New predicates are added deliberately and documented; an Observation can only use
vocabulary that exists, which keeps knowledge **explainable and auditable**.

### 5.3 How knowledge enters reasoning

1. The **matcher** (`knowledge/match.ts`) evaluates every `active` Observation's
   `scope` against the current context + facts.
2. Matches become **knowledge evidence** — `EvidenceItem`s with
   `source: 'knowledge'`, `weight = observation.weight × observation.confidence ×
   observation.track.edge-adjustment`, and `detail` quoting the observation +
   its provenance.
3. Knowledge can also target **gates** (an observation can raise a CAUTION/BLOCK,
   e.g. *"I don't trade the first 15 minutes after a gap"*) or **bias the
   thesis**.
4. The confluence ledger and narrative show structural vs knowledge evidence
   side by side, so you can always see *which of your rules fired and why*.

### 5.4 Accountability (closes P4 with the learning loop)

When an outcome resolves, Memory attributes it to the Observations that fired,
updating each one's `track` (applied / correct / edge). Over time the agent
learns **which of your heuristics actually pay**, can flag ones that have decayed
(`status → testing/retired` suggestions), and weights reliable experience more
heavily. Your experience is first-class *and* held to the same evidentiary
standard as everything else.

### 5.5 Authoring

Observations are authored via a UI form / Markdown-ish editor (Knowledge Lab
workspace **[future]**) and/or imported from the trade journal. They persist
through the same injectable store as Memory. No code change to add knowledge.

---

## 6. Explainability contract (P3)

Every intermediate conclusion conforms to one envelope:

```ts
interface Reasoned<T> {
  value: T;                       // the conclusion (a fact, a thesis, a verdict…)
  evidence: EvidenceRef[];        // what supports it (structural and/or knowledge)
  assumptions: string[];          // what must be true for this to hold
  invalidation: string;           // the concrete condition that would overturn it
  confidence: number;             // 0..1, calibrated and tracked over time
  provenance: string[];           // which modules / observations produced it
}
```

- The current `ResearchNote` already carries thesis, evidence, pre-mortem
  (invalidation), gates, and conviction. **Migration [planned]:** formalise
  `Reasoned<T>` and wrap Perception facts and Thesis in it so explainability is
  structural, not ad-hoc.
- **Rule:** no module may output a bare conclusion. If it can't state evidence,
  assumptions, invalidation, and confidence, it isn't allowed to influence the
  verdict.

---

## 7. Communication & data flow

**One deliberation (`research(context)`):**
```
Context ─▶ Perception(facts) ─┐
                              ├─▶ Thesis ─▶ Evidence{structural + knowledge}
Knowledge(matches) ───────────┘                    │
                                                   ▼
                                  Pre-mortem ─▶ Gates ─▶ Conviction(+memory edge)
                                                   │
                                                   ▼
                                  Sizing ─▶ Verdict ─▶ ResearchNote ─▶ UI
```
- **Pull-based** within a deliberation: each step calls the next with typed
  inputs. Pure functions, no shared mutable state.
- **Event/feedback** across deliberations: resolving an outcome writes to Memory;
  Memory adjusts conviction priors and knowledge reliability on the *next* run.
- **No back-channels.** Perception cannot read Reasoning; the UI cannot mutate a
  note; the LLM cannot change a verdict.

---

## 8. Module ownership (sole-writer matrix)

| Data / contract        | Owner (sole writer)        | Readers                          |
|------------------------|----------------------------|----------------------------------|
| VOLARA→fields mapping  | Data Providers             | Context                          |
| `MarketContext`        | Context                    | Perception, Knowledge, Reasoning |
| `RegimeRead` / facts   | Perception                 | Reasoning, Knowledge, UI         |
| `Observation` corpus   | Knowledge                  | Reasoning, Memory, UI            |
| `EvidenceItem[]`       | Reasoning (evidence.ts)    | Conviction, UI                   |
| `RiskGate[]`           | Reasoning (gates.ts)       | Conviction, Verdict, UI          |
| `Conviction`/`Sizing`  | Reasoning (conviction.ts)  | Verdict, UI                      |
| `ResearchNote`         | Orchestration (agent.ts)   | UI, Memory                       |
| `OutcomeRecord`/stats  | Memory                     | Conviction, Knowledge, UI        |
| Durable storage        | Persistence                | Memory, Knowledge                |

If two modules want to write the same data, the design is wrong — split it.

---

## 9. Extension seams for the six future features (P6)

Each future capability is a **plug-in at one seam**, no core rewrite:

| Future feature            | Seam                                   | Contract it speaks            |
|---------------------------|----------------------------------------|-------------------------------|
| **Chart vision** (TradingView screenshots) | new Data Provider → emits structural facts (levels, patterns) into `MarketContext`/Perception | `MarketContext` partial + `Reasoned<Fact>` |
| **Memory of situations**  | Memory module: store full context fingerprints; nearest-neighbour recall feeds Conviction as a prior | `SetupStats`-like `SituationMatch` |
| **Trade-journal learning**| Knowledge importer + Memory: journal entries → Observations + outcome attribution | `Observation`, `OutcomeRecord` |
| **Live news / macro**     | new Data Provider + Perception reader → macro facts + an `event_risk` knowledge/gate input | `MarketContext` partial, gate input |
| **Optional LLM reasoning**| Narrative layer only: narrates decided `Reasoned<T>` objects; never edits the verdict | read-only `ResearchNote` |
| **Automated workflows**   | Orchestration: schedule + chain `research()` runs, emit reports | `ResearchNote[]` |

The fact that all six map cleanly onto existing seams is the test that this
architecture is right.

---

## 10. Directory layout

```
src/agent/
  provider.ts          [built]   VOLARA adapter (the ONLY VOLARA import)
  context.ts           [planned] multi-provider assembly + data quality
  types.ts             [built]   core contracts
  regime.ts            [built]   perception: regime/character
  perception/          [planned] structure · liquidity · positioning · volState
  knowledge/           [planned] types · store · match · predicates
  thesis.ts            [built]   reasoning: hypothesis
  evidence.ts          [built]   reasoning: structural confluence (+knowledge [planned])
  premortem.ts         [built]   reasoning: disconfirmation
  gates.ts             [built]   reasoning: capital-preservation vetoes
  conviction.ts        [built]   reasoning: conviction · grade · sizing
  agent.ts             [built]   orchestration: one deliberation + narrative
  memory.ts            [built]   memory: outcomes · setup edge (injectable store)
  memory/              [future]  situations · journal
  narrative/           [future]  optional LLM narration
  orchestration/       [future]  workflows · scheduling
  scenarios.ts         [built]   labelled DEMO contexts (no live backend)
  useAgent.ts          [built]   React binding
src/components/agent/   [built]   UI panels
src/workspaces/ResearchAgent.tsx  [built]
```

---

## 11. Roadmap — MVP → production

Each phase has an **exit criterion** (how we know it's done) and respects all six
principles.

- **Phase 0 — MVP reasoning desk** ✅ *(current)*
  Full pipeline (regime → thesis → confluence → pre-mortem → gates → conviction
  → sizing → verdict), seeded learning loop, demo scenarios, explainable note.
  *Exit:* a graded, gated, sized, self-critiquing note renders on live or demo
  data. **Met.**

- **Phase 1 — Explainability & contracts hardening** *(next, post-agreement)*
  Introduce `Reasoned<T>`; split `context.ts` from `provider.ts`; add per-field
  data provenance; calibrate confidence. *Exit:* every conclusion carries
  evidence/assumptions/invalidation/confidence by construction.

- **Phase 2 — Knowledge layer (your experience)**
  `Observation` model + behavioural predicate vocabulary + matcher + a Knowledge
  Lab to author/import observations; knowledge enters confluence and gates with
  provenance. *Exit:* you can encode a real trading rule and watch it fire,
  reason, and be tracked — with zero indicator math.

- **Phase 3 — Memory of situations & journal learning**
  Situation fingerprints + nearest-neighbour recall; trade-journal import →
  Observations + outcome attribution; knowledge reliability auto-updates. *Exit:*
  the agent cites *"a similar situation on <date> resolved X"* and adjusts.

- **Phase 4 — Perception depth (structure & liquidity)**
  Real price-structure/levels/liquidity readers (still no indicators). *Exit:*
  facts like *"failed breakout into thin liquidity"* drive theses.

- **Phase 5 — External reasoning inputs**
  News/macro provider + chart-vision provider feeding facts. *Exit:* a screenshot
  or a headline measurably changes a note, explainably.

- **Phase 6 — Optional LLM narration + automated workflows**
  LLM narrates decided notes; scheduler runs research and emits reports. *Exit:*
  prose explanations and a daily automated research run, with the decision path
  still fully rule-based and auditable.

- **Phase 7 — Production-grade**
  Durable store (SQLite/VOLARA-backed), calibration/backtest of decision quality
  (hit-rate, avg-R, expectancy by setup *and by observation*), monitoring. *Exit:*
  measurable, improving decision quality over time on out-of-sample data.

---

## 12. Non-goals (explicit exclusions)

- ❌ Merging into VOLARA, or depending on VOLARA beyond the provider seam (P1).
- ❌ An indicator/oscillator-driven core (P5).
- ❌ Auto-execution / order routing — this is a **research** agent; it advises, it
  does not trade. (Revisit only as a deliberate, separate decision.)
- ❌ Black-box ML in the decision path. Models may *narrate* or *retrieve*, never
  *decide* unexplained (P3).
- ❌ Optimising behaviour to look good on the demo feed — demo scenarios exist
  only so the reasoning is legible without a backend.

---

## 13. Open questions to resolve together

1. **Observation authoring** — UI form, Markdown file, or both? How structured vs
   free-text do you want the `statement` and `conditions`?
2. **Predicate vocabulary** — shall we draft the *first* set of behavioural
   predicates from a handful of your real rules, so the vocabulary is grounded in
   how you actually think?
3. **Confidence semantics** — is `confidence` your subjective trust, the
   system's calibrated estimate, or both surfaced separately?
4. **Outcome resolution** — manual for now, or wire to VOLARA fills/P&L in
   Phase 3? What defines WIN/LOSS/SCRATCH and the R unit for *you*?
5. **Instrument scope** — NIFTY-only initially, or multi-instrument knowledge
   from the start (affects `scope.instruments` and memory keys)?
6. **Persistence target** — stay on localStorage through Phase 2, or move to
   SQLite sooner so knowledge/journal survive across machines?

---

*Agree, amend, or push back on any section. Nothing further is coded until we've
settled §1–§9 and the §13 questions that block Phase 1–2.*
