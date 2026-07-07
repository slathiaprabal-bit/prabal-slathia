"""Live volatility-surface + regime dashboard (the cinematic "NO-GO" view).

Renders, in the browser:
  * a 3D implied-volatility surface (IV% over strike × days-to-expiry)
  * a GO / CAUTION / NO-GO market-regime verdict card
  * the key vol/regime telemetry (VIX, IV-rank, VRP, expected move)

It re-runs the full decision pipeline on every page load and the page
auto-refreshes, so pointed at a live feed it is a live model. With no live
chain the IV surface is a *parametric skew/term model* anchored to the current
VIX and IV-rank (equity-index negative skew + term structure that backwardates
when IV-rank is high) — clearly labelled as synthetic, consistent with the rest
of the engine. Plug a real per-strike chain into data.py and the same surface
renders live IVs.

No Python plotting dependency: the Plotly figure is assembled as JSON and drawn
by plotly.js from a CDN in the browser.
"""

from __future__ import annotations

import json
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np

from .config import Config
from .report import build_decision

# Neon colourscale (deep navy -> cyan -> near-white) matching the mock.
_COLORSCALE = [
    [0.0, "#04203a"], [0.25, "#0a5688"], [0.5, "#119fd6"],
    [0.72, "#3fd6f5"], [0.88, "#8df3ff"], [1.0, "#f2ffff"],
]


def _surface_from_live(points, vs, n_strike: int):
    """Grid a real [Strike, DTE, IV] point cloud into (strikes, dtes, iv_grid).

    Each listed expiry is its own IV smile; we interpolate that smile across a
    common strike axis. No scipy dependency — per-expiry np.interp.
    """
    spot = vs.spot
    lo = max(points["Strike"].min(), spot * 0.85)
    hi = min(points["Strike"].max(), spot * 1.15)
    strikes = np.linspace(lo, hi, n_strike)
    expiries = sorted(d for d in points["DTE"].unique() if d >= 0)[:8]
    if not expiries:
        return None
    grid = np.empty((len(expiries), n_strike))
    for j, dte in enumerate(expiries):
        sm = points[points["DTE"] == dte].sort_values("Strike")
        if len(sm) < 3:
            grid[j, :] = np.interp(strikes, points["Strike"], points["IV"])
        else:
            grid[j, :] = np.interp(strikes, sm["Strike"], sm["IV"])
    return strikes, np.array(expiries, dtype=float), grid


def build_surface(vs, config: Config, n_strike: int = 41, n_dte: int = 28):
    """IV surface: real NSE per-strike IV when available, else parametric.

    Returns (strikes, dtes, iv_grid) where iv_grid[j, i] is IV% at
    strike[i], dte[j].
    """
    # Prefer the live chain's real implied-vol skew/term when reachable.
    if getattr(config, "use_live", True) and getattr(config, "use_live_chain", True):
        try:
            from .nse_chain import iv_surface_points
            pts = iv_surface_points(config.primary)
            if pts is not None and len(pts):
                live = _surface_from_live(pts, vs, n_strike)
                if live is not None:
                    return live
        except Exception:
            pass
    return parametric_surface(vs, n_strike, n_dte)


def parametric_surface(vs, n_strike: int = 41, n_dte: int = 28):
    """Smooth fitted "Model" surface from the vol state (no chain needed).

    Models the stylised facts of index vol:
      * negative skew/smile across strikes (OTM puts bid, calls cheaper)
      * term structure that backwardates in high-IV-rank (stress) regimes
        and contangos in calm low-IV-rank regimes.
    """
    spot = vs.spot
    atm = vs.vix if vs.vix == vs.vix else 14.0          # ATM IV anchor (%)
    ivr = (vs.iv_rank if vs.iv_rank == vs.iv_rank else 50.0) / 100.0

    # Strikes span ~±12% of spot; moneyness m = K/spot - 1.
    strikes = np.linspace(spot * 0.88, spot * 1.12, n_strike)
    dtes = np.linspace(2, 45, n_dte)
    m = strikes / spot - 1.0

    # Skew: puts (m<0) richer. Slope steepens with IV-rank; smile curvature.
    # Moneyness is tanh-saturated (~±7%) so the far wings flatten toward an
    # asymptote like a real index smile instead of accelerating quadratically.
    skew_slope = 55.0 + 35.0 * ivr        # vol points per unit moneyness
    smile_curv = 180.0 + 120.0 * ivr
    mw = 0.07
    ms = mw * np.tanh(m / mw)
    skew = -skew_slope * ms + smile_curv * ms * ms       # per-strike add to ATM

    # Term: high IV-rank -> backwardation (short-dated richer), low -> contango.
    # Smile/skew DECAY with maturity (a stylised fact: front expiries carry the
    # steepest smiles, back expiries are smoother — roughly a power law in T),
    # so each expiry gets its own curvature instead of a scaled copy.
    ref = 7.0
    term_beta = 0.22 * (ivr - 0.5)        # +ve => short > long
    grid = np.empty((n_dte, n_strike))
    for j, t in enumerate(dtes):
        term_mult = 1.0 + term_beta * (np.sqrt(ref / t) - 1.0)
        smile_decay = float(np.clip((ref / max(t, 1.0)) ** 0.35, 0.55, 1.6))
        grid[j, :] = np.clip(atm * term_mult + skew * smile_decay, 5.0, None)
    return strikes, dtes, grid


def verdict(reg, vs) -> dict:
    """Map regime + vol state to a GO / CAUTION / NO-GO traffic light."""
    spike = reg.vix_chg >= 8.0
    high_vol = vs.vix >= 20.0
    if not reg.policy.trade or vs.vix >= 26.0:
        label, color, sub = ("NO-GO", "#ff2d6e",
                              f"High volatility · stay out  ({reg.regime.value})")
    elif reg.policy.size_mult <= 0.6 or spike or high_vol:
        label, color, sub = ("CAUTION", "#ffb020",
                              f"Reduced size · {reg.regime.value.replace('_', ' ').title()}")
    else:
        label, color, sub = ("GO", "#16f5b0",
                              f"Favourable · {reg.regime.value.replace('_', ' ').title()}")
    return {"label": label, "color": color, "sub": sub}


def trade_style(reg, vs) -> dict:
    """Should today be a DIRECTIONAL or NON-DIRECTIONAL trade (or stand aside)?

    Driven by the regime policy's strategy family and trend strength:
      * neutral family (condor/strangle/fly)  -> NON-DIRECTIONAL premium sell
      * bullish/bearish family (credit spread) -> DIRECTIONAL with that bias
      * no-trade regime                        -> STAND ASIDE
    """
    fam = reg.policy.strategy_family
    pref = " · ".join(s.replace("_", " ").title()
                      for s in reg.policy.preferred[:2]) or "—"
    if not reg.policy.trade:
        return {"style": "STAND ASIDE", "color": "#ff2d6e",
                "detail": "No edge — protect capital", "pref": "—"}
    if fam == "neutral":
        return {"style": "NON-DIRECTIONAL", "color": "#16f5b0",
                "detail": f"Range / rich IV (IVR {vs.iv_rank:.0f}) — sell premium",
                "pref": pref}
    bias = "BULLISH" if fam == "bullish" else "BEARISH"
    return {"style": "DIRECTIONAL", "color": "#3fd6f5",
            "detail": f"{bias} bias · trend {reg.trend_strength:+.1f} ATR",
            "pref": pref}


def _figure_json(strikes, dtes, grid, max_pain: float | None = None) -> str:
    data = [{
        "type": "surface",
        "x": strikes.round(0).tolist(),
        "y": dtes.round(0).tolist(),
        "z": grid.round(2).tolist(),
        "colorscale": _COLORSCALE,
        "showscale": False,
        "opacity": 0.93,
        "contours": {
            "z": {"show": True, "usecolormap": True, "width": 2,
                  "highlightcolor": "#9bf6ff", "project": {"z": False}},
            "x": {"show": True, "color": "#1d6f9e", "width": 1},
            "y": {"show": True, "color": "#1d6f9e", "width": 1},
        },
        "lighting": {"ambient": 0.65, "diffuse": 0.85, "specular": 0.35,
                     "roughness": 0.5, "fresnel": 0.2},
        "hoverinfo": "x+y+z",
    }]
    # Glowing amber wall at the max-pain strike (the OI "pin" for the day).
    if max_pain is not None and strikes.min() <= max_pain <= strikes.max():
        zlo, zhi = float(grid.min()), float(grid.max()) * 1.05
        ylo, yhi = float(dtes.min()), float(dtes.max())
        data.append({
            "type": "scatter3d", "mode": "lines+text",
            "x": [max_pain, max_pain, max_pain],
            "y": [ylo, yhi, yhi], "z": [zhi, zhi, zlo],
            "line": {"color": "#ffd166", "width": 7},
            "text": ["", f"MAX PAIN {max_pain:,.0f}", ""],
            "textposition": "top center",
            "textfont": {"color": "#ffd166", "size": 12},
            "hoverinfo": "text", "name": "Max Pain",
        })
    axis = {"gridcolor": "#16324a", "zerolinecolor": "#16324a",
            "color": "#5fb8d8", "backgroundcolor": "rgba(0,0,0,0)",
            "showbackground": True}
    layout = {
        "paper_bgcolor": "rgba(0,0,0,0)", "plot_bgcolor": "rgba(0,0,0,0)",
        "margin": {"l": 0, "r": 0, "t": 0, "b": 0},
        "scene": {
            "xaxis": {**axis, "title": "STRIKE"},
            "yaxis": {**axis, "title": "DTE"},
            "zaxis": {**axis, "title": "IV %"},
            "camera": {"eye": {"x": 1.5, "y": -1.5, "z": 0.7}},
            "aspectratio": {"x": 1.4, "y": 1.0, "z": 0.6},
        },
        "showlegend": False,
    }
    return json.dumps({"data": data, "layout": layout})


def render_html(config: Config, refresh: int = 20) -> str:
    d = build_decision(config)
    vs, reg, pos = d.vol_state, d.regime, d.positioning
    strikes, dtes, grid = build_surface(vs, config)
    fig = _figure_json(strikes, dtes, grid, max_pain=pos.max_pain)
    v = verdict(reg, vs)
    ts = trade_style(reg, vs)
    now = datetime.now().strftime("%I:%M %p")
    live = "LIVE" if d.source.lower().startswith("live") else "SYNTHETIC"
    vrp = vs.iv_minus_hv
    mp_dist = pos.max_pain - vs.spot
    metrics = [
        ("VIX", f"{vs.vix:.1f}"), ("IV RANK", f"{vs.iv_rank:.0f}"),
        ("VRP (IV-HV)", f"{vrp:+.1f}"), ("EXP. MOVE", f"±{vs.em_expiry:.0f}"),
        ("MAX PAIN", f"{pos.max_pain:,.0f}"), ("REGIME", reg.regime.value.replace("_", " ")),
    ]
    chips = "".join(
        f'<div class="chip"><span class="k">{k}</span>'
        f'<span class="val">{val}</span></div>' for k, val in metrics)
    oi_tag = "SYNTHETIC OI" if pos.synthetic else "LIVE OI"
    playbook = f"""
    <div class="pb-row"><span class="pb-k">TRADE STYLE</span>
         <span class="pb-v" style="color:{ts['color']}">{ts['style']}</span></div>
    <div class="pb-detail">{ts['detail']}</div>
    <div class="pb-row"><span class="pb-k">STRUCTURE</span>
         <span class="pb-v sm">{ts['pref']}</span></div>
    <div class="pb-sep"></div>
    <div class="pb-row"><span class="pb-k">MAX PAIN</span>
         <span class="pb-v" style="color:#ffd166">{pos.max_pain:,.0f}</span></div>
    <div class="pb-detail">{mp_dist:+,.0f} pts from spot {vs.spot:,.0f} · pin into expiry</div>
    <div class="pb-row"><span class="pb-k">PCR (OI)</span>
         <span class="pb-v sm">{pos.pcr_oi}</span>
         <span class="pb-k" style="margin-left:auto">{oi_tag}</span></div>
    <div class="pb-detail">S {('/'.join(f'{x:,.0f}' for x in pos.support)) or '—'}
         &nbsp;·&nbsp; R {('/'.join(f'{x:,.0f}' for x in pos.resistance)) or '—'}</div>"""

    return f"""<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="{refresh}">
<title>NIFTY Vol Surface · Regime</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<style>
  :root {{ --neon:#3fd6f5; --bg:#050a14; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:
        radial-gradient(120% 90% at 50% 0%, #0a1426 0%, #050a14 60%, #02060d 100%);
        color:#cfe9f5; font-family:"SF Mono",ui-monospace,Menlo,Consolas,monospace;
        overflow:hidden; height:100vh; }}
  .frame {{ position:absolute; inset:14px; border:1px solid #123;
        border-radius:14px; box-shadow:0 0 60px rgba(20,120,180,.18) inset; }}
  .topbar {{ position:absolute; top:22px; left:30px; right:30px;
        display:flex; justify-content:space-between; letter-spacing:.32em;
        font-size:13px; color:#6fd3ef; text-transform:uppercase; z-index:5; }}
  .sub {{ position:absolute; top:52px; right:30px; font-size:11px;
        letter-spacing:.28em; color:#3f7f9c; z-index:5; }}
  #chart {{ position:absolute; inset:0; z-index:1; }}
  .metrics {{ position:absolute; top:78px; left:30px; display:flex; gap:10px;
        flex-wrap:wrap; z-index:5; }}
  .chip {{ background:rgba(10,30,52,.55); border:1px solid #134; border-radius:8px;
        padding:7px 12px; min-width:78px; backdrop-filter:blur(3px); }}
  .chip .k {{ display:block; font-size:9px; letter-spacing:.18em; color:#5c93ad; }}
  .chip .val {{ display:block; font-size:16px; color:#aef0ff; margin-top:2px; }}
  .card {{ position:absolute; bottom:42px; left:50%; transform:translateX(-50%);
        width:340px; text-align:center; padding:20px 24px;
        background:rgba(8,16,30,.78); border:1px solid {v['color']};
        border-radius:16px; box-shadow:0 0 40px {v['color']}55; z-index:6;
        backdrop-filter:blur(6px); }}
  .card .hd {{ font-size:11px; letter-spacing:.4em; color:#8fb8c9; }}
  .card .lbl {{ font-size:54px; font-weight:800; letter-spacing:.08em;
        color:{v['color']}; text-shadow:0 0 26px {v['color']}; margin:6px 0; }}
  .card .sub2 {{ font-size:12px; letter-spacing:.06em; color:#bcd; }}
  .playbook {{ position:absolute; top:128px; right:30px; width:260px;
        background:rgba(8,16,30,.7); border:1px solid #163049; border-radius:14px;
        padding:16px 18px; z-index:6; backdrop-filter:blur(5px);
        box-shadow:0 0 30px rgba(20,120,180,.15); }}
  .playbook .ttl {{ font-size:10px; letter-spacing:.34em; color:#6fa9c2;
        margin-bottom:12px; }}
  .pb-row {{ display:flex; align-items:baseline; gap:8px; margin:7px 0; }}
  .pb-k {{ font-size:9px; letter-spacing:.18em; color:#5c93ad; }}
  .pb-v {{ font-size:18px; font-weight:700; color:#aef0ff; margin-left:auto; }}
  .pb-v.sm {{ font-size:11px; font-weight:500; text-align:right; }}
  .pb-detail {{ font-size:10px; color:#7fb3c8; margin:-2px 0 8px; line-height:1.4; }}
  .pb-sep {{ height:1px; background:#163049; margin:10px 0; }}
  .src {{ position:absolute; bottom:16px; left:30px; font-size:10px;
        letter-spacing:.2em; color:#3a6377; z-index:5; }}
</style></head>
<body>
  <div class="frame"></div>
  <div class="topbar"><span>Volatility Surface · Regime Analysis</span>
       <span>{now}</span></div>
  <div class="sub">NIFTY VOL SURFACE · {now}</div>
  <div class="metrics">{chips}</div>
  <div class="playbook"><div class="ttl">TODAY'S PLAYBOOK</div>{playbook}</div>
  <div id="chart"></div>
  <div class="card">
    <div class="hd">MARKET REGIME</div>
    <div class="lbl">{v['label']}</div>
    <div class="sub2">{v['sub']}</div>
  </div>
  <div class="src">{live} DATA · {d.source} · auto-refresh {refresh}s ·
       surface = {'LIVE NSE chain IV' if not pos.synthetic else f'parametric skew/term (VIX {vs.vix:.1f}, IVR {vs.iv_rank:.0f})'}</div>
  <script>
    var fig = {fig};
    Plotly.newPlot('chart', fig.data, fig.layout,
                   {{responsive:true, displayModeBar:false}});
  </script>
</body></html>"""


def serve(config: Config, port: int = 8080, refresh: int = 20) -> None:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path not in ("/", "/index.html"):
                self.send_error(404); return
            html = render_html(config, refresh).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)

        def log_message(self, *a):  # quiet
            pass

    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Live dashboard: http://localhost:{port}  (refresh {refresh}s, Ctrl-C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")
        srv.shutdown()
