"""Event source abstraction.

A source returns a forward window of EventRecords. Swap the bootstrap sources
for a live calendar API / paid provider (Trading Economics, MarketWatch, a
direct Fed/BLS/RBI/NSE feed) by adding one class and registering it in the
scheduler — the scheduler, service, route and frontend never change.

Sources MUST return None (never raise, never fabricate) when unreachable, so the
scheduler keeps the last-good event set.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..models import EventRecord


@runtime_checkable
class EventSource(Protocol):
    name: str
    def fetch(self) -> "list[EventRecord] | None": ...
