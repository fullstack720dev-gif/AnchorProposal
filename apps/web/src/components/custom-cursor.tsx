'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Simple desktop custom cursor: one teal dot that tracks the pointer 1:1.
 * Skips touch / coarse pointers and reduced-motion preferences.
 */
export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.documentElement.classList.add('has-custom-cursor');

    const interactiveSelector =
      'a, button, [role="button"], input, textarea, select, label, summary, [tabindex]:not([tabindex="-1"])';

    const onMove = (e: MouseEvent) => {
      const el = cursorRef.current;
      if (!el) return;
      // 5px = half of base 10px size; hover grow is centered via transform origin default
      const size = el.dataset.hover === '1' ? 7 : 5;
      el.style.transform = `translate3d(${e.clientX - size}px, ${e.clientY - size}px, 0)`;
    };

    const onOver = (e: MouseEvent) => {
      const el = cursorRef.current;
      const target = e.target as Element | null;
      if (!el || !target?.closest) return;
      el.dataset.hover = target.closest(interactiveSelector) ? '1' : '0';
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      document.documentElement.classList.remove('has-custom-cursor');
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={cursorRef}
      className="ap-cursor pointer-events-none fixed left-0 top-0"
      aria-hidden
    />
  );
}
