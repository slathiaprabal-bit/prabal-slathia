import { useCallback, useRef, useState } from 'react';

// Element-size hook built on a CALLBACK ref: the observer re-attaches whenever
// the observed element itself unmounts/remounts (e.g. a chart passing through
// an empty state while data switches), not just when the component mounts.
export function useSize<T extends HTMLElement>() {
  const roRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((el: T | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);
  return { ref, ...size };
}
