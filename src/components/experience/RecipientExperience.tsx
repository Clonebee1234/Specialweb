/**
 * Recipient experience shell — cinematic version.
 *
 * - Renders the passcode entry box with auto-submit on 4 digits (Req 9.2).
 * - Fetches /api/celebrations/:sc/content on successful unlock.
 * - Dispatches the payload to the birthday or expression chapter stack.
 *
 * Accepts `previewPayload` to render sample data without a backend — used
 * by `/preview/[type]` so you can walk through both experiences with no DB.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChapterCinematicReveal,
  ChapterFinalLetter,
  ChapterGrandFinale,
  ChapterQuiz,
  ChapterReasonsConstellation,
  ChapterStoryScroll,
  ChapterUnwrapping,
} from './chapters/birthday';
import {
  ChapterConfession,
  ChapterEnvelope,
  ChapterMoments,
  ChapterNoticing,
  ChapterReply,
  ChapterSlowBuild,
  ChapterSoftEnding,
} from './chapters/expression';

type CelebrationPayload = {
  type: 'birthday' | 'expression';
  theme: string;
  recipient_name: string;
  creator_name: string;
  relationship: string;
  song_url: string | null;
  photos: Array<{ url: string; caption: string; order: number }>;
  hero_text?: string;
  reasons?: string[];
  quiz_questions?: Array<{
    prompt: string;
    options: [string, string, string, string];
    correctIndex: number;
  }>;
  final_message?: string;
  confession_message?: string;
  things_i_notice?: string[];
  closing_line?: string;
};

export function RecipientExperience({
  shortCode,
  previewPayload,
}: {
  shortCode: string;
  previewPayload?: CelebrationPayload;
}) {
  const [payload, setPayload] = useState<CelebrationPayload | null>(previewPayload ?? null);

  useEffect(() => {
    if (previewPayload) return;
    fetch(`/api/celebrations/${shortCode}/content`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (r.ok) return setPayload(await r.json());
      })
      .catch(() => undefined);
  }, [shortCode, previewPayload]);

  if (!payload) {
    return <PasscodeEntry shortCode={shortCode} onUnlocked={setPayload} />;
  }

  return (
    <main
      className={`min-h-screen text-text-primary theme-${payload.theme}`}
      style={{ backgroundColor: 'var(--bg-a)' }}
    >
      {/* Also set the theme on <html> so the browser chrome and scrollbar
          match, and the body's default bg doesn't peek through. */}
      <ThemeSideEffect theme={payload.theme} />
      {payload.type === 'birthday' ? (
        <BirthdayExperience payload={payload} />
      ) : (
        <ExpressionExperience payload={payload} shortCode={shortCode} />
      )}
      {payload.song_url && <AudioPlayer src={payload.song_url} />}
    </main>
  );
}

/* ============================================================ */
/*  Theme side-effect — applies the theme class to <html> so     */
/*  CSS variables cascade everywhere (including body & scrollbar).*/
/* ============================================================ */

function ThemeSideEffect({ theme }: { theme: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const all = [
      'theme-confetti-burst',
      'theme-golden-glow',
      'theme-neon-night',
      'theme-starry-dream',
      'theme-midnight-letters',
      'theme-soft-bloom',
      'theme-warm-sunset',
    ];
    for (const t of all) root.classList.remove(t);
    root.classList.add(`theme-${theme}`);
    return () => {
      root.classList.remove(`theme-${theme}`);
    };
  }, [theme]);
  return null;
}

/* ============================================================ */
/*  Passcode entry                                              */
/* ============================================================ */

function PasscodeEntry({
  shortCode,
  onUnlocked,
}: {
  shortCode: string;
  onUnlocked: (p: CelebrationPayload) => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  async function trySubmit(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/celebrations/${shortCode}/unlock`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Incorrect passcode.');
        setShake((s) => s + 1);
        setDigits(['', '', '', '']);
        inputs.current[0]?.focus();
        return;
      }
      const payloadRes = await fetch(`/api/celebrations/${shortCode}/content`, {
        credentials: 'same-origin',
      });
      const payload = await payloadRes.json();
      if (!payloadRes.ok) {
        setError(payload?.error?.message ?? 'Could not load celebration.');
        return;
      }
      onUnlocked(payload);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, v: string) {
    const ch = v.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[i] = ch;
    setDigits(next);
    if (ch && i < 3) inputs.current[i + 1]?.focus();
    if (next.every((d) => d.length === 1)) {
      void trySubmit(next.join(''));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-a px-6 text-center text-text-primary">
      <div className="w-full max-w-sm">
        <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
          Someone made something for you
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Enter your passcode</h1>
        <div
          key={shake}
          className="mt-8 flex justify-center gap-3 data-[shake]:animate-[ct-shake_0.4s]"
          data-shake={shake > 0 ? 'true' : undefined}
          style={{
            animation: shake > 0 ? 'ct-shake 0.4s ease-in-out' : undefined,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete="one-time-code"
              aria-label={`Passcode digit ${i + 1}`}
              value={digits[i]}
              disabled={busy}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) {
                  inputs.current[i - 1]?.focus();
                }
              }}
              className="h-16 w-14 rounded-lg border border-white/15 bg-black/40 text-center text-3xl outline-none focus:border-accent-1"
            />
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        {busy && <p className="mt-4 text-sm text-text-muted">Unlocking…</p>}
      </div>
      <style jsx global>{`
        @keyframes ct-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </main>
  );
}

/* ============================================================ */
/*  Birthday stack                                              */
/* ============================================================ */

function BirthdayExperience({ payload }: { payload: CelebrationPayload }) {
  const [unwrapped, setUnwrapped] = useState(false);

  if (!unwrapped) {
    return (
      <ChapterUnwrapping
        recipientName={payload.recipient_name}
        onOpen={() => setUnwrapped(true)}
      />
    );
  }

  return (
    <>
      <ChapterCinematicReveal
        recipientName={payload.recipient_name}
        creatorName={payload.creator_name}
      />
      <ChapterStoryScroll heroText={payload.hero_text} photos={payload.photos} />
      {payload.reasons && payload.reasons.length > 0 && (
        <ChapterReasonsConstellation
          recipientName={payload.recipient_name}
          reasons={payload.reasons}
        />
      )}
      {payload.quiz_questions && payload.quiz_questions.length > 0 && (
        <ChapterQuiz
          questions={payload.quiz_questions}
          creatorName={payload.creator_name}
        />
      )}
      {payload.final_message && (
        <ChapterFinalLetter
          message={payload.final_message}
          creatorName={payload.creator_name}
        />
      )}
      <ChapterGrandFinale recipientName={payload.recipient_name} />
      <Footer />
    </>
  );
}

/* ============================================================ */
/*  Expression stack                                            */
/* ============================================================ */

function ExpressionExperience({
  payload,
  shortCode,
}: {
  payload: CelebrationPayload;
  shortCode: string;
}) {
  const [opened, setOpened] = useState(false);
  const [replied, setReplied] = useState(false);

  if (!opened) {
    return <ChapterEnvelope onOpen={() => setOpened(true)} />;
  }

  return (
    <>
      <ChapterSlowBuild recipientName={payload.recipient_name} />
      {payload.things_i_notice && payload.things_i_notice.length > 0 && (
        <ChapterNoticing items={payload.things_i_notice} />
      )}
      {payload.photos.length > 0 && <ChapterMoments photos={payload.photos} />}
      {payload.confession_message && (
        <ChapterConfession
          message={payload.confession_message}
          creatorName={payload.creator_name}
          closingLine={payload.closing_line}
        />
      )}
      {!replied && (
        <ChapterReply
          shortCode={shortCode}
          recipientName={payload.recipient_name}
          creatorName={payload.creator_name}
          theme={payload.theme}
          onDone={() => setReplied(true)}
        />
      )}
      <ChapterSoftEnding />
      <Footer />
    </>
  );
}

/* ============================================================ */
/*  Audio player                                                */
/* ============================================================ */

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-full border border-white/10 bg-black/80 px-3 py-2 backdrop-blur">
      <audio ref={audioRef} src={src} loop preload="auto">
        <track kind="captions" />
      </audio>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-sm text-accent-1"
          aria-label={playing ? 'Pause music' : 'Play music'}
          onClick={() => {
            const a = audioRef.current;
            if (!a) return;
            if (a.paused) {
              a.play();
              setPlaying(true);
            } else {
              a.pause();
              setPlaying(false);
            }
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-label="Volume"
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            if (audioRef.current) audioRef.current.volume = v;
          }}
          className="w-20 accent-accent-1"
        />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/50 py-10 text-center text-xs text-text-muted">
      Made with love on CelebrateThem
    </footer>
  );
}
