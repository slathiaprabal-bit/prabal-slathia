"""Scheduled, cached, provider-abstracted Official Data subsystem.

Replaces the edit-on-every-release config with a per-indicator schedule + a
persistent cache + a source abstraction. Official figures are fetched from real
sources on their own cadence (e.g. FII/DII after market close, CPI/GDP/Repo on
their release schedule), cached with full provenance, and kept as last-good when
a source is unreachable. New sources (FRED / RBI / NSE / Bloomberg / Refinitiv /
Polygon) plug in by adding one class to sources.py — nothing else changes.
"""
