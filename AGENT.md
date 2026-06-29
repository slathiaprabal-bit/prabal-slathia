# AI Trading Research Agent

> **Architecture & design charter:** see [`AGENT_ARCHITECTURE.md`](./AGENT_ARCHITECTURE.md)
> for the governing design principles, full module map, data-ownership rules,
> the Knowledge subsystem, and the MVP→production roadmap. This file is the
> quick overview; the charter is the source of truth.

An **independent** research subsystem that thinks like an experienced
discretionary trader. It does **not** generate buy/sell signals. Its job is to
**reduce bad trades, improve decision quality, preserve capital, and learn from
prior market behaviour** — the way a hedge-fund / prop-desk research process
operates.

VOLARA (the volatility terminal, option chain, Greeks, gamma, HMM, analytics)
is treated here purely as a **data provider**. The agent never reads VOLARA's
internals or its signals — it consumes a single normalised `MarketContext` and
runs its own deliberation.

```
VOLARA Snapshot ──▶ provider.ts ──▶ MarketContext
                                         │
                    ┌────────────────────┴───────────────────────────┐
                    ▼                                                 │
   1. readRegime    →  what market is this? is it tradeable at all?   │
   2. formThesis    →  a falsifiable hypothesis (not a signal)        │
   3. gatherEvidence→  CONFLUENCE: independent factors, for & against │
   4. runPreMortem  →  DISCONFIRMATION: assume it failed — why?       │
   5. runGates      →  hard CAPITAL-PRESERVATION vetoes               │
   6. scoreConviction→ weight-of-evidence → conviction + A–F grade    │
   7. sizePosition  →  risk-based, conviction-scaled, hard-capped     │
   8. decideVerdict →  ENGAGE / SCALE_IN / WAIT / REDUCE / STAND ASIDE│
                    ▼                                                 │
              ResearchNote  ──▶  memory (learned edge per setup) ─────┘
                                  (feeds back into step 6)
```

## Why this is not a signal generator

A signal says *"buy."* A research note says *"here is my thesis, here is the
independent evidence for and against it, here is exactly how I am wrong, here
are the hard reasons I might do nothing, here is how much I'd risk, and here is
the track record of this exact setup."* The verdict is the **end of a
deliberation**, and the agent is designed to be **hard to convince** — the cost
of a missed trade is far smaller than the cost of a bad one.

Every output is **deterministic and explainable**. There is no opaque model in
the decision path; each conclusion is traceable to the step that produced it
(see the *Reasoning* panel — the agent thinking out loud).

## The eight steps

| Step | File | What a trader is doing |
|------|------|------------------------|
| Provider | `provider.ts` | Pull the tape into one clean read. VOLARA is just the feed. |
| **Regime read** | `regime.ts` | *"What kind of market is this?"* — TREND / RANGE / VOLATILE EXPANSION / COMPRESSION / EVENT-DRIVEN / UNTRADEABLE. Declares which structures the regime rewards. |
| **Thesis** | `thesis.ts` | A falsifiable hypothesis with an explicit basis — *not* a signal. |
| **Confluence** | `evidence.ts` | Six independent collectors (trend, premium edge, dealer gamma, room-to-target, positioning, containment) each report alignment with the thesis. No single factor carries a trade. |
| **Pre-mortem** | `premortem.ts` | *"Assume this has already lost — why?"* Failure modes ranked by likelihood × severity, plus a concrete **invalidation level** (the pre-committed exit). This is the core defence against confirmation bias. |
| **Risk gates** | `gates.ts` | Non-negotiable capital-preservation vetoes: event risk, untradeable regime, portfolio heat, margin, data integrity, short-premium-into-vol, against-regime. A `BLOCK` gate kills a perfect setup. |
| **Conviction & grade** | `conviction.ts` | Weighted consensus minus dissonance, nudged by learned edge, capped by gates → an **A–F grade**. Only A/B earn capital. |
| **Sizing** | `conviction.ts` | Risk-per-idea scaled by conviction, then hard-capped by free heat budget and reduced in volatile regimes. Capital preservation wins ties. |
| **Verdict** | `agent.ts` | `ENGAGE` · `SCALE_IN` · `WAIT_FOR_TRIGGER` · `REDUCE_RISK` · `STAND_ASIDE`, each with a concrete trigger / what-would-change-my-mind. |

## Memory & continuous learning (`memory.ts`)

Every note is logged with a **setup key** (`regime | structure | stance`). When
an outcome resolves, the agent updates a per-setup track record:

- **Beta-smoothed hit-rate** (pseudo-counts so a 2-trade sample never poses as
  an edge).
- **Average R** across resolved trades.
- A **confidence-discounted edge** (trust grows with sample size).

That edge feeds **back into the conviction step**, so the agent leans toward
what has actually worked in each regime and away from what hasn't — a closed
feedback loop, not a static model. The *Memory* panel makes this visible and
lets you resolve the live note's outcome (WIN / SCRATCH / LOSS) to teach the
agent in real time. Storage is an injectable interface (`setPersist`) — browser
`localStorage` today, swappable for a VOLARA/SQLite-backed store later without
touching the reasoning engine.

## Running it

It is wired in as the **Research Agent** workspace (brain icon) in the existing
terminal. With no live backend, the agent would honestly refuse almost
everything on VOLARA's synthetic demo feed, so — per the terminal's *never blank
in DEMO* rule — it rotates through representative `scenarios.ts` contexts that
exercise the full decision range (clearly labelled `DEMO`). On a live feed it
deliberates over real `MarketContext` and only re-authors its note when the read
materially changes.

```bash
npm run dev     # open the Research Agent workspace (brain icon)
npm run lint    # tsc --noEmit
npm run build
```

## Design boundaries

- **Independent.** Lives entirely under `src/agent/`. The only seam to VOLARA is
  `provider.ts`. Nothing in the agent imports VOLARA's signal/decision logic.
- **Pure & testable.** Every reasoning step is a pure function over plain
  objects — no React, no I/O — so the pipeline can be unit-tested or replayed.
- **Honest.** Synthetic / stale data is gated, not silently trusted.

## Roadmap (next layers)

1. **Live outcome ingestion** — resolve notes from real VOLARA fills / P&L
   instead of manual buttons.
2. **Optional LLM narration** — a thin Gemini layer (`@google/genai` is already
   a dependency) to render the *deterministic* reasoning into prose. The
   decision path stays rule-based; the model only narrates.
3. **Regime-conditioned priors** — separate memory by volatility bucket and
   time-of-day.
4. **Scenario / replay engine** — drive the agent over historical context for
   walk-forward evaluation of decision quality (hit-rate, avg-R, expectancy by
   setup) rather than raw P&L.
5. **Correlation & concentration gate** — veto adding risk correlated to the
   existing book.
