/**
 * Typewriter — reveals text one character at a time at a configurable rate.
 *
 * Used by:
 *   - ChapterFinalLetter (birthday)      ~30 chars/sec
 *   - ChapterConfession (expression)     ~25 chars/sec
 *
 * Reduced-motion: the full text appears immediately.
 */

'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function Typewriter({
  text,
  charsPerSecond = 30,
  className,
  onDone,
}: {
  text: string;
  charsPerSecond?: number;
  className?: string;
  onDone?: () => void;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? text : '');

  useEffect(() => {
    if (reduced) {
      setShown(text);
      onDone?.();
      return;
    }
    let i = 0;
    setShown('');
    const interval = 1000 / charsPerSecond;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        onDone?.();
      }
    }, interval);
    return () => window.clearInterval(id);
  }, [text, charsPerSecond, reduced, onDone]);

  return <span className={className}>{shown}</span>;
}
