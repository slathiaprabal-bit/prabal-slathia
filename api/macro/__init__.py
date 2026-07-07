"""VOLARA Macro Intelligence subsystem (isolated, additive).

A provider-abstracted macro engine. Live market data comes from a pluggable
provider (yfinance today); slow official figures (Repo/CPI/GDP) and dated flows
(FII/DII, breadth) come from a versioned official config. Every metric carries
full provenance (value, previous, timestamp, freshness, source, confidence,
status) so the UI never silently shows stale or fabricated data.

This package does NOT touch the quant engine, the live-market WebSocket, or any
existing snapshot field. It is wired into the app via api/macro/router.py.
"""
