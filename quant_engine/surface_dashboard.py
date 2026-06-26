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


def build_surface(vs, config: Config, n_strike: int = 41, n_dte: int = 28):
    """Parametric IV surface anchored to live ATM IV (VIX) and IV-rank.

    Returns (strikes, dtes, iv_grid) where iv_grid[j, i] is IV% at
    strike[i], dte[j]. Models the two stylised facts of index vol:
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
    skew_slope = 55.0 + 35.0 * ivr        # vol points per unit moneyness
    smile_curv = 180.0 + 120.0 * ivr
    skew = -skew_slope * m + smile_curv * m * m          # per-strike add to ATM

    # Term: high IV-rank -> backwardation (short-dated richer), low -> contango.
    ref = 7.0
    term_beta = 0.22 * (ivr - 0.5)        # +ve => short > long
    grid = np.empty((n_dte, n_strike))
    for j, t in enumerate(dtes):
        term_mult = 1.0 + term_beta * (np.sqrt(ref / t) - 1.0)
        grid[j, :] = np.clip((atm + skew) * term_mult, 5.0, None)
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


def _figure_json(strikes, dtes, grid) -> str:
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
    vs, reg = d.vol_state, d.regime
    strikes, dtes, grid = build_surface(vs, config)
    fig = _figure_json(strikes, dtes, grid)
    v = verdict(reg, vs)
    now = datetime.now().strftime("%I:%M %p")
    live = "LIVE" if d.source.lower().startswith("live") else "SYNTHETIC"
    vrp = vs.iv_minus_hv
    metrics = [
        ("VIX", f"{vs.vix:.1f}"), ("IV RANK", f"{vs.iv_rank:.0f}"),
        ("VRP (IV-HV)", f"{vrp:+.1f}"), ("EXP. MOVE", f"±{vs.em_expiry:.0f}"),
        ("REGIME", reg.regime.value.replace("_", " ")),
        ("CONFIDENCE", f"{d.confidence:.0f}%"),
    ]
    chips = "".join(
        f'<div class="chip"><span class="k">{k}</span>'
        f'<span class="val">{val}</span></div>' for k, val in metrics)

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
  .src {{ position:absolute; bottom:16px; left:30px; font-size:10px;
        letter-spacing:.2em; color:#3a6377; z-index:5; }}
</style></head>
<body>
  <div class="frame"></div>
  <div class="topbar"><span>Volatility Surface · Regime Analysis</span>
       <span>{now}</span></div>
  <div class="sub">NIFTY VOL SURFACE · {now}</div>
  <div class="metrics">{chips}</div>
  <div id="chart"></div>
  <div class="card">
    <div class="hd">MARKET REGIME</div>
    <div class="lbl">{v['label']}</div>
    <div class="sub2">{v['sub']}</div>
  </div>
  <div class="src">{live} DATA · {d.source} · auto-refresh {refresh}s ·
       surface = parametric skew/term model (anchor VIX {vs.vix:.1f}, IVR {vs.iv_rank:.0f})</div>
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
