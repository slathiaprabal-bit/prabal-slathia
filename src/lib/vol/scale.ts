// Shared IV → color/height normalization for the surface, heatmap and legend.
// The domain adapts to the LIVE surface so the full ramp is always used — a
// 12–20 IV day must span the whole blue→red scale, not sit in one cyan band.
export function gridRange(iv: number[][]): { lo: number; hi: number } {
  let lo = Infinity, hi = -Infinity;
  for (const row of iv) for (const v of row) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!isFinite(lo)) return { lo: 8, hi: 24 };
  const pad = Math.max(0.4, (hi - lo) * 0.06);
  return { lo: lo - pad, hi: hi + pad };
}
