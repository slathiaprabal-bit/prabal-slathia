export const inr = (v: number | null | undefined, dp = 0): string => {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(dp > 0 ? dp : 1)}k`;
  return `₹${v.toFixed(dp)}`;
};

export const num = (v: number | null | undefined, dp = 1): string =>
  v === null || v === undefined || !isFinite(v) ? '—' : v.toFixed(dp);

export const pct = (v: number | null | undefined, dp = 1): string =>
  v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 100).toFixed(dp)}%`;

export const signed = (v: number | null | undefined, dp = 1): string =>
  v === null || v === undefined || !isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`;

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Interpolate a colour-stop scale at t in [0,1] -> #rrggbb
export function sampleScale(stops: [number, string][], t: number): string {
  t = clamp(t, 0, 1);
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const f = (t - lo[0]) / span;
  const c1 = hexToRgb(lo[1]);
  const c2 = hexToRgb(hi[1]);
  const r = Math.round(lerp(c1[0], c2[0], f));
  const g = Math.round(lerp(c1[1], c2[1], f));
  const b = Math.round(lerp(c1[2], c2[2], f));
  return `rgb(${r},${g},${b})`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
