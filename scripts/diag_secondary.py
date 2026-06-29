"""Diagnostic: trace the secondary-index data flow end to end and print the
actual value at every backend stage. Run from the repo root:

    python scripts/diag_secondary.py

It prints, per stage:
  1. RAW yfinance  — what each Yahoo symbol actually returns (last close)
  2. get_secondary_indices() — the merged dict the refresher publishes
  3. build_snapshot()["secondary"] — the exact block sent over the WebSocket

Compare stage 1 vs the symbol you expect:
  - ^NSEBANK  -> BankNifty   (~50k)
  - ^BSESN    -> Sensex      (~79k)   <- the field reported wrong
  - NIFTY_FIN_SERVICE.NS -> FinNifty  (~24k)
If ^BSESN's last close is NOT ~79k, the data source / symbol is the culprit.
"""
from quant_engine.config import Config
from quant_engine import data as D


def stage1_raw():
    print("== STAGE 1 — RAW yfinance per symbol ==")
    try:
        import yfinance as yf
    except Exception as e:
        print("  yfinance unavailable:", e); return
    for key, sym in D._SECONDARY_SYMBOLS.items():
        try:
            px = yf.download(sym, period="5d", interval="1d",
                             progress=False, auto_adjust=False)
            px = D._flatten(px) if px is not None else None
            if px is None or px.empty or "Close" not in px:
                print(f"  key={key:9s} sym={sym:22s} -> NO DATA")
                continue
            closes = px["Close"].to_numpy(dtype=float).ravel()
            print(f"  key={key:9s} sym={sym:22s} rows={len(closes):3d} "
                  f"last_close={closes[-1]:,.2f}")
        except Exception as e:
            print(f"  key={key:9s} sym={sym:22s} -> ERROR {e}")


def stage2_merged():
    print("\n== STAGE 2 — get_secondary_indices() ==")
    sec = D.get_secondary_indices(Config())
    for k, v in sec.items():
        print(f"  {k:9s} -> {v}")


def stage3_snapshot():
    print("\n== STAGE 3 — build_snapshot()['secondary'] (WebSocket payload) ==")
    from api.serializers import build_snapshot
    snap = build_snapshot(Config())
    print("  spot (NIFTY):", snap.get("spot"))
    print("  secondary   :", snap.get("secondary"))


if __name__ == "__main__":
    stage1_raw()
    stage2_merged()
    stage3_snapshot()
    print("\nFrontend mapping (Sidebar.tsx): SENSEX<-sec.sensex, "
          "FINNIFTY<-sec.finnifty, BANKNIFTY<-sec.banknifty (verified correct).")
