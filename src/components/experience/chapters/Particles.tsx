/**
 * Particles — light-weight ambient background (fireflies / stars / sparkles).
 *
 * Pure CSS animation; zero JS after mount. Disabled when reduced-motion is on.
 * Count and color adapt to the theme via CSS variables.
 */

'use client';

import { useMemo } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function Particles({
  count = 28,
  kind = 'sparkle',
}: {
  count?: number;
  kind?: 'sparkle' | 'firefly' | 'petal';
}) {
  const reduced = useReducedMotion();
  const items = useMemo(() => {
    // Deterministic layout per render — not random — so SSR markup matches.
    return Array.from({ length: count }).map((_, i) => {
      const ratio = i / Math.max(1, count - 1);
      return {
        left: `${((i * 37) % 100).toFixed(2)}%`,
        top: `${((i * 53) % 100).toFixed(2)}%`,
        size: 2 + ((i * 7) % 5),
        delay: ratio * 4,
        duration: 3 + ((i * 11) % 5),
      };
    });
  }, [count]);

  if (reduced) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {items.map((p, idx) => (
        <span
          key={idx}
          className={`absolute rounded-full bg-accent-1 ${
            kind === 'firefly' ? 'blur-sm' : ''
          }`}
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            opacity: 0,
            animation: `ct-sparkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
