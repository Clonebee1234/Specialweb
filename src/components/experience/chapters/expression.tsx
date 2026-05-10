/**
 * Expression cinematic chapters. Slower, more intimate pacing than birthday.
 * Never triggers confetti (Req 13.6).
 *
 * Chapters: Envelope → SlowBuild → Noticing → Moments → Confession → Reply → Soft Ending.
 */

'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Typewriter } from './Typewriter';
import { renderReplyImage, type ReplyImageTheme } from '@/lib/canvas/replyImage';
import { browserCanvasAdapter } from '@/lib/canvas/adapter.browser';

type Photo = { url: string; caption: string; order: number };

export type ExpressionPayload = {
  theme: string;
  recipient_name: string;
  creator_name: string;
  photos: Photo[];
  confession_message?: string;
  things_i_notice?: string[];
  closing_line?: string;
};

/* ============================================================ */
/*  Chapter 1 — Envelope                                        */
/* ============================================================ */

export function ChapterEnvelope({ onOpen }: { onOpen: () => void }) {
  const reduced = useReducedMotion();
  const [opening, setOpening] = useState(false);

  function handleOpen() {
    if (opening) return;
    setOpening(true);
    window.setTimeout(onOpen, reduced ? 150 : 1400);
  }

  return (
    <section
      className="flex min-h-screen items-center justify-center px-6 text-center"
      style={{ backgroundColor: 'var(--bg-a)' }}
    >
      <div className="flex flex-col items-center gap-6">
        <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
          Someone has something to tell you
        </p>
        <motion.button
          type="button"
          onClick={handleOpen}
          disabled={opening}
          className="relative flex h-56 w-72 items-center justify-center rounded-lg bg-[#f5f2ea] text-[#3a1a1a] shadow-2xl focus:outline-none"
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={
            opening
              ? reduced
                ? { opacity: 0 }
                : { y: -20, opacity: 0, rotateX: -40 }
              : { opacity: 1, y: 0 }
          }
          transition={{ duration: reduced ? 0.15 : 1.2 }}
          whileHover={{ scale: reduced ? 1 : 1.02 }}
          style={{ animation: reduced ? undefined : 'ct-pulse-soft 4s ease-in-out infinite' }}
          aria-label="Tap to open the letter"
        >
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl">
            ♥
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 origin-top"
            style={{
              background: 'linear-gradient(to bottom, #eadecb 0%, transparent 100%)',
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            }}
          />
        </motion.button>
        <p className="text-sm text-text-muted">
          {opening ? 'Opening…' : 'Tap to open'}
        </p>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 2 — Slow Build                                      */
/* ============================================================ */

export function ChapterSlowBuild({ recipientName }: { recipientName: string }) {
  const lines = [
    `${recipientName}…`,
    "I've been thinking about how to say this…",
    'So I made this for you.',
    'Scroll when you are ready.',
  ];
  return (
    <section
      className="flex min-h-screen items-center justify-center px-6 text-center"
      style={{ backgroundColor: 'var(--bg-a)' }}
    >
      <div className="space-y-12 font-serif text-2xl sm:text-3xl">
        {lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.4, delay: i * 0.6 }}
            className="italic text-text-primary/90"
          >
            {line}
          </motion.p>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 3 — Noticing                                        */
/* ============================================================ */

export function ChapterNoticing({ items }: { items: string[] }) {
  return (
    <section
      style={{
        background: 'linear-gradient(to bottom, var(--bg-a), var(--bg-b))',
      }}
    >
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
        className="sticky top-0 flex min-h-screen items-center justify-center px-6 text-center text-sm uppercase tracking-[0.3em] text-text-muted"
      >
        I notice things about you…
      </motion.p>
      {items.map((it, i) => (
        <div
          key={i}
          className="flex min-h-screen items-center justify-center px-6 text-center"
        >
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.6 }}
            className="max-w-2xl font-serif text-3xl italic leading-relaxed sm:text-4xl"
          >
            {it}
          </motion.p>
        </div>
      ))}
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
        className="flex min-h-[50vh] items-center justify-center px-6 text-center text-lg text-text-muted"
      >
        …and I notice more every day.
      </motion.p>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 4 — Moments (Ken Burns)                             */
/* ============================================================ */

export function ChapterMoments({ photos }: { photos: Photo[] }) {
  const reduced = useReducedMotion();
  return (
    <section style={{ backgroundColor: 'var(--bg-b)' }}>
      {photos.map((p, i) => (
        <div
          key={i}
          className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
        >
          <motion.figure
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.2 }}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption || ''}
              className="aspect-[4/5] w-full object-cover"
              style={{
                animation: reduced ? undefined : 'ct-ken-burns 8s ease-out forwards',
              }}
            />
            {p.caption && (
              <figcaption className="bg-black/50 p-4 text-center font-serif italic text-text-muted backdrop-blur">
                {p.caption}
              </figcaption>
            )}
          </motion.figure>
        </div>
      ))}
    </section>
  );
}

/* ============================================================ */
/*  Chapter 5 — Confession                                      */
/* ============================================================ */

export function ChapterConfession({
  message,
  creatorName,
  closingLine,
}: {
  message: string;
  creatorName: string;
  closingLine?: string | undefined;
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
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1 }}
        className="max-w-2xl space-y-8"
      >
        <div className="whitespace-pre-wrap font-serif text-xl leading-relaxed text-text-primary sm:text-2xl">
          <Typewriter text={message} charsPerSecond={25} onDone={() => setDone(true)} />
        </div>
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="space-y-6"
            >
              <p className="text-right italic text-accent-1">— {creatorName}</p>
              {closingLine && (
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1, delay: 1.5 }}
                  className="pt-8 text-center font-serif text-3xl font-semibold text-accent-1"
                >
                  {closingLine}
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 6 — Reply                                           */
/* ============================================================ */

export function ChapterReply({
  shortCode,
  recipientName,
  creatorName,
  theme,
  onDone,
}: {
  shortCode: string;
  recipientName: string;
  creatorName: string;
  theme: string;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const replyTheme: ReplyImageTheme =
    theme === 'soft-bloom' || theme === 'warm-sunset' ? theme : 'midnight-letters';

  async function download() {
    setBusy(true);
    setErr(null);
    try {
      const bytes = await renderReplyImage(
        {
          replyText: text,
          recipientFirstName: recipientName,
          dateIso: new Date().toISOString(),
          theme: replyTheme,
        },
        browserCanvasAdapter,
      );
      const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-reply-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch {
      setErr('Could not create the image. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/celebrations/${shortCode}/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ replyText: text }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErr(data?.error?.message ?? "We couldn't save your reply. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setErr("We couldn't save your reply. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="flex min-h-screen items-center justify-center px-6 py-16"
      style={{ backgroundColor: 'var(--bg-a)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1 }}
        className="w-full max-w-xl space-y-4"
      >
        <h2 className="text-center text-2xl font-semibold">
          If you would like to say something back…
        </h2>
        {sent ? (
          <div className="rounded-xl border border-green-400/30 bg-green-400/10 p-6 text-center">
            Your reply has been saved. {creatorName} will receive it soon 💛
          </div>
        ) : (
          <>
            <textarea
              className="input min-h-[8rem]"
              maxLength={200}
              value={text}
              placeholder="Type your heart here…"
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{text.length}/200</span>
              <button
                type="button"
                className="underline hover:text-text-primary"
                onClick={onDone}
              >
                Skip
              </button>
            </div>
            {err && <p className="text-sm text-red-300">{err}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                disabled={busy || text.trim().length === 0}
                onClick={download}
                className="rounded-lg border border-white/15 bg-white/5 px-5 py-2 font-medium disabled:opacity-60"
              >
                {busy ? 'Working…' : 'Download as image'}
              </button>
              <button
                type="button"
                disabled={busy || text.trim().length === 0}
                onClick={send}
                className="rounded-lg bg-accent-1 px-5 py-2 font-medium text-black disabled:opacity-60"
              >
                {busy ? 'Sending…' : `Send to ${creatorName}`}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </section>
  );
}

/* ============================================================ */
/*  Chapter 7 — Soft Ending                                     */
/* ============================================================ */

export function ChapterSoftEnding() {
  return (
    <section
      className="flex min-h-screen items-center justify-center px-6 py-20 text-center"
      style={{
        background: 'linear-gradient(to bottom, var(--bg-b), var(--bg-a))',
      }}
    >
      <div className="space-y-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6 }}
          className="font-serif text-2xl italic sm:text-3xl"
        >
          Take your time with this. No rush. 💛
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, delay: 0.8 }}
          className="max-w-xl text-text-muted"
        >
          Some things do not need a response. Just know that you are thought of.
        </motion.p>
      </div>
    </section>
  );
}
