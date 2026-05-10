/**
 * `useReducedMotion` — reads the OS/browser reduced-motion preference.
 *
 * Every animated chapter asks this hook whether to run the full choreography
 * or a static fallback. Per Requirement 21, reduced-motion substitutions
 * must be consistent across the experience.
 */

'use client';

import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}
