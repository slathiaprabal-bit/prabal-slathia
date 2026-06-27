# VOLARA — Design System (FROZEN · Phase 1)

This is the institutional visual contract for VOLARA. Every future phase
**must** inherit these rules. No redesigns — only new analytics built on top of
this system.

> Aesthetic target: Bloomberg Terminal / proprietary derivatives desk.
> Matte black, engineered, dense, restrained. Every pixel has a purpose.

---

## 1. Color tokens (CSS variables in `src/index.css`)

Never hard-code a raw neon hex. Use the token. Color carries **information only**.

| Token | Hex | Use |
|-------|-----|-----|
| `--bg0` | `#000000` | App base (matte black) |
| `--bg1` | `#050505` | Top bar / sidebar / ticker |
| `--bg2` | `#080808` | Nested inset surfaces |
| `--panel` | `#0c0d0f` | Panel fill (graphite) |
| `--line` | `rgba(255,255,255,.07)` | Standard 1px border |
| `--line-soft` | `rgba(255,255,255,.04)` | Internal dividers / cell borders |
| `--text` | `#e7e9ec` | Primary text |
| `--dim` | `#8a909a` | Labels, secondary text |
| `--faint` | `#4b515b` | Tertiary hints |
| `--pos` | `#27d17c` | Bullish / positive / GO |
| `--lime` | `#9be83a` | Strong positive (rare) |
| `--gold` | `#f4b740` | Warning / active nav / brand / neutral-emphasis |
| `--neg` | `#f04668` | Bearish / negative / risk |
| `--violet` | `#c79bff` | Secondary accent (percentile, macro, kelly) |
| `--info` | `#5aa9ff` | Data blue — **surfaces & charts only** |

**Rainbow IV scale** (`IV_STOPS` in `theme.ts`) is the single place colour runs
free, used exclusively for the 3-D surface and its legend.

Rule: background and chrome stay neutral black/graphite. Accents appear only on
data that needs them (a number's sign, a regime, a level).

---

## 2. Surfaces & borders

- Panels use the `.glass` class: graphite fill, **1px `--line` border**,
  `--radius` (8px) corners, soft black shadow. **No coloured glow.**
- Inset sub-cards use the `.cell` class: faint fill, `--line-soft` border,
  6px corners. This is the ONE card primitive — do not re-invent
  `border border-white/5 bg-white/[0.02]`.
- Radius scale: **8px** panels (`.glass`), **6px** cells/buttons, **4px** tiny
  badges, `full` only for dots / progress rails. Nothing larger.

---

## 3. Typography

- Sans: **Inter**. Mono: **JetBrains Mono** (`.mono`, tabular-nums) for ALL
  numbers.
- `.section-title` (11px, 0.18em tracking, uppercase, 600) → panel headers.
- `.eyebrow` (9px, 0.16em tracking, uppercase, `--dim`) → metric labels.
- Hero metric values: 15–17px mono bold. Avoid `text-3xl`+ except a single
  focal stat per panel.

---

## 4. Layout

- Shell: `TopBar (h-12)` · `Sidebar (212px)` · workspace · `MarketNews (h-8)`.
- Every workspace is a `grid grid-cols-12 grid-rows-6 gap-2 h-full`.
- The router host gives workspaces a **definite height** (`h-full` chain) so
  grids fill the viewport — never collapse to content.
- Panel padding: header `px-3 py-1.5`, body `px-3 py-2.5`. Gaps: `gap-2`.
- Distribute content (`justify-between`) in tall panels — avoid centred groups
  that leave dead space.

---

## 5. Components (canonical)

- **Panel** (`ui/Panel.tsx`): accent tick + section-title header, content body.
- **Cell** (`.cell`): label + value metric tile.
- **Gauge** (`ui/Gauge.tsx`): 270° arc, no glow.
- **LineChart** (`charts/LineChart.tsx`): 1.75px stroke, subtle gradient fill,
  optional `ghosts` / `dots` / `pointLabels`. No glow.
- **AnimatedNumber**: rAF easing for all streaming values.
- **Sidebar item** (`.nav-item`): icon (16px) + label, amber active rail.
- **Badge / tag**: 4px radius, `${token}/10` bg, `${token}` text.

---

## 6. Motion

Premium and subtle: panel mount fade/slide (≤0.4s), workspace cross-fade
(0.3s blur), number roll, soft `pulse` on live dots. No bounce, no neon flicker.

---

## 7. Hard rules (do not break)

1. No raw legacy neon hex — tokens only.
2. No coloured `box-shadow` glow. Depth = border + black shadow.
3. One card primitive (`.cell`), one panel primitive (`.glass`).
4. Blue (`--info`) only on surfaces/charts.
5. Mono for every number.
6. Workspaces fill height; no dead space.
