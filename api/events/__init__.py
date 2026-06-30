"""VOLARA Market Event Intelligence — backend subsystem (Phase A, additive).

An event-driven market-intelligence feed (not a calendar): scheduled macro,
policy, and market-structure events with full provenance. Mirrors the Macro
Intelligence provider/scheduler/cache architecture. Sources are swappable
(StaticScheduleSource / ExpirySource today; live calendar APIs later) and never
fabricate dates — unknown events are simply absent.

The backend serves RAW events + provenance + metadata only. Deterministic
trading logic (impact rating, recommended action, week-risk score, countdown)
lives on the frontend (Phase B), exactly like the Macro engine.

Every EventRecord carries a stable `type` (e.g. "US_CPI", "RBI_MPC") so future
Historical Event Analytics can group occurrences without any refactor. Does NOT
touch the quant engine, the live-market WebSocket, or the Macro module.
"""
