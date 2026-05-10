/**
 * Birthday cinematic chapters. Each section is self-contained and uses
 * framer-motion for entrance animation + scroll-triggered reveals. The parent
 * renders them back-to-back inside a single scrolling main element.
 *
 * Reduced-motion: every animation collapses to an instant opacity fade.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Particles } from './Particles';
import { Typewriter } from './Typewriter';

type Photo = { url: string; caption: string; order: number };
type QuizQuestion = {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
};

export type BirthdayPayload = {
  theme: string;
  recipient_name: string;
  creator_name: string;
  photos: Photo[];
  hero_text?: string;
  reasons?: string[];
  quiz_questions?: QuizQuestion[];
  final_message?: string;
};

/* ============================================================ */
/*  Chapter 1 — Unwrapping                                      */
/* ============================================================ */

export function ChapterUnwrapping({
  recipientName,
  onOpen,
}: {
  recipientName: string;
  onOpen: () => void;
}) {
  const reduced = useReducedMotion();
  const [opening, setOpening] = useState(false);

  function handleOpen() {
    if (opening) return;
    setOpening(true);
    if (!reduced) fireCenterBurst();
    window.setTimeout(onOpen, reduced ? 200 : 1200);
  }

  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 text-center"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, var(--bg-b), var(--bg-a) 80%)',
      }}
    >
      <Particles count={32} kind="sparkle" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
          For {recipientName}
        </p>
        <motion.button
          type="button"
          onClick={handleOpen}
          disabled={opening}
          className="group relative flex h-48 w-48 items-center justify-center rounded-2xl border border-accent-1/40 bg-gradient-to-br from-white/5 to-white/10 shadow-glow focus:outline-none"
          initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
          animate={
            opening
              ? reduced
                ? { opacity: 0 }
                : { scale: 1.2, opacity: 0, rotate: 8 }
              : { opacity: 1, scale: 1 }
          }
          transition={{ duration: reduced ? 0.15 : 1 }}
          whileHover={{ scale: reduced ? 1 : 1.03 }}
          style={{ animation: reduced ? undefined : 'ct-float 4s ease-in-out infinite' }}
          aria-label="Tap to unwrap your surprise"
        >
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 bg-accent-1/40" />
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-accent-1/40" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-accent-1 bg-accent-1/30" />
          <span className="relative z-10 text-5xl">🎁</span>
        </motion.button>
        <p className="text-sm text-text-muted">
          {opening ? 'Unwrapping…' : 'Tap to unwrap your surprise'}
        </p>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 2 — Cinematic Reveal                                */
/* ============================================================ */

export function ChapterCinematicReveal({
  recipientName,
  creatorName,
}: {
  recipientName: string;
  creatorName: string;
}) {
  const reduced = useReducedMotion();
  const letters = recipientName.split('');
  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 text-center"
      style={{
        background: 'linear-gradient(to bottom, var(--bg-a), var(--bg-b))',
      }}
    >
      <Particles count={40} kind="firefly" />
      <div className="relative z-10 space-y-6">
        <p className="text-xs uppercase tracking-[0.4em] text-accent-1">Happy Birthday</p>
        <h1 className="text-7xl font-semibold sm:text-8xl">
          {letters.map((ch, i) => (
            <motion.span
              key={i}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: reduced ? 0.01 : 0.6,
                delay: reduced ? 0 : i * 0.08,
                ease: 'easeOut',
              }}
              className="inline-block"
            >
              {ch === ' ' ? '\u00A0' : ch}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: reduced ? 0 : 1.2 }}
          className="text-lg text-text-muted"
        >
          From {creatorName}, with all my heart 💛
        </motion.p>
        <ScrollCue />
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 3 — Story Scroll                                    */
/* ============================================================ */

export function ChapterStoryScroll({
  heroText,
  photos,
}: {
  heroText?: string | undefined;
  photos: Photo[];
}) {
  return (
    <section
      className="space-y-24 py-24 px-6"
      style={{ backgroundColor: 'var(--bg-a)' }}
    >
      {heroText && (
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-2xl text-center font-serif text-2xl italic text-text-muted sm:text-3xl"
        >
          &ldquo;{heroText}&rdquo;
        </motion.p>
      )}
      {photos.map((p, i) => (
        <StoryPhoto key={i} photo={p} align={i % 2 === 0 ? 'left' : 'right'} />
      ))}
    </section>
  );
}

function StoryPhoto({ photo, align }: { photo: Photo; align: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  return (
    <div
      ref={ref}
      className={`mx-auto flex max-w-4xl flex-col items-center gap-6 sm:flex-row ${
        align === 'right' ? 'sm:flex-row-reverse' : ''
      }`}
    >
      <motion.figure
        initial={{ opacity: 0, x: align === 'left' ? -40 : 40, scale: 0.95 }}
        animate={inView ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: align === 'left' ? -40 : 40, scale: 0.95 }}
        transition={{ duration: 1 }}
        className="relative w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl sm:w-2/3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || ''}
          className="aspect-[4/3] w-full object-cover"
        />
      </motion.figure>
      {photo.caption && (
        <motion.figcaption
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="font-serif text-lg italic text-text-muted sm:w-1/3"
        >
          {photo.caption}
        </motion.figcaption>
      )}
    </div>
  );
}

/* ============================================================ */
/*  Chapter 4 — Reasons Constellation                           */
/* ============================================================ */

export function ChapterReasonsConstellation({
  recipientName,
  reasons,
}: {
  recipientName: string;
  reasons: string[];
}) {
  return (
    <section
      className="relative overflow-hidden py-24 px-6"
      style={{
        background: 'linear-gradient(to bottom, var(--bg-b), var(--bg-a))',
      }}
    >
      <Particles count={50} kind="sparkle" />
      <div className="relative mx-auto max-w-3xl space-y-12 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-3xl font-semibold sm:text-4xl"
        >
          Why you make everything better, {recipientName}
        </motion.h2>
        <ul className="space-y-4 text-left">
          {reasons.map((r, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <span className="mt-0.5 text-accent-1" aria-hidden>
                ★
              </span>
              <span>{r}</span>
            </motion.li>
          ))}
        </ul>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-lg text-text-muted"
        >
          …and a universe more 💛
        </motion.p>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 5 — Quiz                                            */
/* ============================================================ */

const SCORE_MESSAGES: Record<number, string> = {
  0: "Well… at least you're cute 😂💛",
  1: 'I think you were guessing. But we have time 💛',
  2: "Okay, I'm planning a 'get to know me' date night 😂",
  3: 'Not bad! We clearly need more late-night conversations.',
  4: 'So close to perfect — just like you 😏',
  5: 'You know me better than I know myself. That is love. 💛',
};

export function ChapterQuiz({
  questions,
  creatorName,
}: {
  questions: QuizQuestion[];
  creatorName: string;
}) {
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[idx];

  function pick(i: number) {
    if (selected !== null || !q) return;
    setSelected(i);
    const correct = i === q.correctIndex;
    if (correct) {
      setScore((s) => s + 1);
      if (!reduced) fireBurst({ from: 'corners' });
    }
    window.setTimeout(
      () => {
        setSelected(null);
        if (idx + 1 >= questions.length) setDone(true);
        else setIdx(idx + 1);
      },
      correct ? 1800 : 2500,
    );
  }

  return (
    <section
      className="relative min-h-screen py-20 px-6"
      style={{
        background: 'linear-gradient(to bottom, var(--bg-a), var(--bg-b))',
      }}
    >
      <div className="mx-auto max-w-2xl">
        <p className="mb-8 text-center text-sm uppercase tracking-[0.3em] text-accent-1">
          How well do you know {creatorName}?
        </p>
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="rounded-2xl border border-accent-1/40 bg-white/5 p-8 text-center"
            >
              <div className="text-6xl font-semibold text-accent-1">
                <CountUp to={score} />/{questions.length}
              </div>
              <p className="mt-4 text-lg text-text-muted">
                {SCORE_MESSAGES[score] ?? SCORE_MESSAGES[0]}
              </p>
            </motion.div>
          ) : (
            q && (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <div className="mb-2 text-xs text-text-muted">
                  Question {idx + 1} of {questions.length}
                </div>
                <h3 className="mb-6 text-2xl font-semibold">{q.prompt}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {q.options.map((opt, i) => {
                    const correct = selected !== null && i === q.correctIndex;
                    const wrong = selected !== null && i === selected && i !== q.correctIndex;
                    return (
                      <motion.button
                        key={i}
                        type="button"
                        disabled={selected !== null}
                        onClick={() => pick(i)}
                        whileHover={{ scale: reduced ? 1 : 1.02 }}
                        whileTap={{ scale: reduced ? 1 : 0.98 }}
                        animate={
                          wrong ? { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } } : {}
                        }
                        className={`rounded-lg border p-4 text-left transition ${
                          correct
                            ? 'border-green-400 bg-green-400/20'
                            : wrong
                              ? 'border-red-400 bg-red-400/20'
                              : 'border-white/15 bg-black/20 hover:border-accent-1/60'
                        }`}
                      >
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function CountUp({ to }: { to: number }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      setN(current);
      if (current >= to) window.clearInterval(id);
    }, 180);
    return () => window.clearInterval(id);
  }, [to, reduced]);
  return <>{n}</>;
}

/* ============================================================ */
/*  Chapter 6 — Final Letter                                    */
/* ============================================================ */

export function ChapterFinalLetter({
  message,
  creatorName,
}: {
  message: string;
  creatorName: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <section
      className="flex min-h-screen items-center justify-center px-6 py-20"
      style={{
        background: 'linear-gradient(to bottom, var(--bg-b), var(--bg-a))',
      }}
    >
      <motion.article
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/95 to-white/90 p-10 text-gray-900 shadow-2xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, #000 1px, transparent 1px), radial-gradient(circle at 80% 70%, #000 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />
        <div className="relative whitespace-pre-wrap font-serif text-lg leading-relaxed">
          <Typewriter text={message} charsPerSecond={35} onDone={() => setDone(true)} />
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={done ? { opacity: 1 } : {}}
          transition={{ duration: 1.2 }}
          className="mt-8 text-right font-signature text-3xl italic"
          style={{ fontFamily: 'cursive' }}
        >
          — {creatorName}
        </motion.p>
      </motion.article>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 7 — Grand Finale                                    */
/* ============================================================ */

export function ChapterGrandFinale({
  recipientName,
}: {
  recipientName: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  useEffect(() => {
    if (!inView || reduced) return;
    // Multi-burst confetti: left, right, centre.
    const end = Date.now() + 2500;
    const interval = window.setInterval(() => {
      if (Date.now() > end) return window.clearInterval(interval);
      confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1 } });
    }, 300);
    // Gentle ongoing drift
    const drift = window.setInterval(() => {
      confetti({ particleCount: 6, startVelocity: 15, spread: 120, origin: { x: Math.random(), y: 0 } });
    }, 900);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(drift);
    };
  }, [inView, reduced]);

  return (
    <section
      ref={ref}
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24 text-center"
      style={{
        background: 'linear-gradient(to bottom, var(--bg-a), var(--bg-b))',
      }}
    >
      <motion.h2
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="text-5xl font-semibold sm:text-6xl"
      >
        Happy birthday, {recipientName}! 🎂🎉
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.5 }}
        className="max-w-lg text-lg text-text-muted"
      >
        Now go celebrate — you deserve every bit of happiness in this world.
      </motion.p>
      <p className="mt-8 text-xs uppercase tracking-[0.3em] text-text-muted">
        💡 Screen record and keep this forever
      </p>
    </section>
  );
}

/* ============================================================ */
/*  Helpers                                                     */
/* ============================================================ */

function ScrollCue() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 1.8 }}
      className="mt-20 flex flex-col items-center gap-1 text-xs uppercase tracking-[0.3em] text-text-muted"
    >
      <span>Scroll to continue</span>
      <motion.span
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="text-lg"
      >
        ↓
      </motion.span>
    </motion.div>
  );
}

function fireCenterBurst() {
  confetti({
    particleCount: 120,
    spread: 90,
    origin: { x: 0.5, y: 0.5 },
    startVelocity: 45,
  });
}

function fireBurst({ from }: { from: 'corners' | 'center' }) {
  if (from === 'corners') {
    confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
    confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
  } else {
    confetti({ particleCount: 80, spread: 70, origin: { x: 0.5, y: 0.6 } });
  }
}
