# VOLARA — Quant Volatility Terminal (frontend)

An institutional-grade trading terminal for the existing Python quant engine.
**The engine and the Streamlit dashboard are untouched** — this is a new
presentation layer added alongside them (phased migration).

```
quant_engine (Python, unchanged)
      │
      ▼
  api/  FastAPI + WebSocket  ──>  serializes engine outputs (no trading logic)
      │
      ▼
  src/  React + TypeScript + Three.js (R3F) + D3 + Tailwind + Motion
```

## What's in Phase 1

- **Live 3D implied-vol surface** (R3F): morphing glowing wireframe, neon
  colourscale, orbit / zoom / pan, animated lighting, regime-driven roughness.
- **Animated market-regime panel** — 6 states, colour + pulse transitions.
- **Greeks panel** — Δ Γ Θ ν Charm Vanna Vomma Speed, colour-coded, rolling.
- **Risk engine** — radial gauges (heat, margin, P(ruin), E[DD], Kelly) +
  Monte-Carlo return distribution.
- **AI decision engine** — structure, confidence, edge, premium richness,
  expected return, max loss, tail risk, entry/exit/stop, reasons / rejects.
- **Option-chain OI heatmap** — clickable strikes, max-pain marker.
- **Vol smile + term structure** (D3), animated.

Everything streams from the engine over a WebSocket and auto-refreshes. If the
backend isn't running the UI falls back to an in-browser mock so it's never
blank (top-right badge shows **LIVE** vs **DEMO**).

## Run it

**1. Backend** (from the repo root):

```bash
pip install -r quant_engine/requirements.txt
pip install -r api/requirements.txt
uvicorn api.server:app --port 8000          # REST /api/snapshot · WS /ws/stream
```

**2. Frontend** (repo root):

```bash
npm install
npm run dev                                 # http://localhost:3000
```

The frontend connects to `ws://<host>:8000/ws/stream`. Override with a
`VITE_WS_URL` env var if the API runs elsewhere.

```bash
npm run build      # production bundle (Three.js chunk is lazy / code-split)
npm run lint       # tsc --noEmit type-check
```

## Notes

- Max-pain / PCR / chain and the surface skew are **live** when the NSE chain
  feed in `quant_engine/nse_chain.py` is reachable, else clearly-labelled
  synthetic (same honesty contract as the engine).
- Streamlit (`quant_engine/dashboard.py`) is intentionally **left in place**;
  it will be retired only once every panel is migrated here.

## Next phases

IV-rank / HV-vs-IV / VIX history charts · dealer-positioning & GEX profile ·
cone projection & scenario tree · drawdown cone overlay · per-strike gamma
exposure surface · saved layouts.
