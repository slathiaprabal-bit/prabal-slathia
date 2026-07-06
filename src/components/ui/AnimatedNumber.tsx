import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  format?: (v: number) => string;
  className?: string;
  duration?: number; // ms
}

// Smoothly rolls from the previous value to the next using rAF easing.
export function AnimatedNumber({
  value,
  format = (v) => v.toFixed(0),
  className = '',
  duration = 600,
}: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    // Snap immediately (no roll) on first paint, a non-finite value, or a
    // discontinuity — a large relative jump that means a source switch
    // (mock -> live) or field reuse rather than a normal market tick. This
    // guarantees the displayed number is always the current snapshot value or a
    // small interpolation toward it, never rolling through a stale/foreign one.
    const discontinuous = !isFinite(from) ||
      Math.abs(to - from) > Math.max(1, Math.abs(to)) * 0.25;
    if (from === to || !isFinite(to) || discontinuous) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    // Brief directional flash on a genuine tick (green up / red down). Uses the
    // Web Animations API so it re-fires cleanly every update and is skipped when
    // the user prefers reduced motion. Purely presentational — no value change.
    const el = elRef.current;
    const reduced = typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (el && !reduced) {
      const up = to > from;
      const tint = up ? '#35d6a0' : '#f4677e';
      const end = getComputedStyle(el).color;
      el.animate(
        [
          { color: tint, textShadow: `0 0 10px ${up ? 'rgba(53,214,160,0.5)' : 'rgba(244,103,126,0.5)'}` },
          { color: end, textShadow: '0 0 0 rgba(0,0,0,0)' },
        ],
        { duration: 550, easing: 'ease-out' },
      );
    }
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span ref={elRef} className={`mono ${className}`}>{format(display)}</span>;
}
