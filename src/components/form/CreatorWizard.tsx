/**
 * Creator form — a single-file multi-step wizard.
 *
 * Why one file: the steps share tons of state and validation; splitting into
 * ten tiny components adds import noise without real clarity. Each step is a
 * small sub-component defined in this file.
 *
 * Validation strategy: we rely on the store as the source of truth and run
 * lightweight per-step checks before advancing. The final submit re-validates
 * everything server-side via Zod.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreatorFormStore, type QuizQuestionDraft } from '@/lib/state/useCreatorFormStore';
import {
  BIRTHDAY_THEMES,
  EXPRESSION_THEMES,
  RELATIONSHIPS,
} from '@/lib/validation/shared';
import type { CelebrationType, PhotoRow } from '@/lib/supabase/types';
import { compressImageToWebp, ImageTooLargeError } from '@/lib/client/compressImage';
import { publicEnv } from '@/lib/env';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_TITLES: Record<Step, string> = {
  1: 'Choose an occasion',
  2: 'The basics',
  3: 'Pick a theme',
  4: 'Your content',
  5: 'Security & timing',
  6: 'Preview & generate',
};

export function CreatorWizard({ initialType }: { initialType: CelebrationType | null }) {
  const router = useRouter();
  const store = useCreatorFormStore();
  const [step, setStep] = useState<Step>(initialType ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // On mount: if the landing page pre-selected the type, propagate into the store.
  useEffect(() => {
    if (initialType && !store.type) store.setType(initialType);
    store.ensureDraftToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    setError(null);
    const err = validateStep(step, store);
    if (err) {
      setError(err);
      return;
    }
    if (step < 6) setStep((step + 1) as Step);
  }

  function goBack() {
    setError(null);
    if (step > 1) setStep((step - 1) as Step);
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = buildSubmitPayload(store);
      const res = await fetch('/api/celebrations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Something went wrong.');
        return;
      }
      store.setSubmitResult({
        shortCode: data.shortCode,
        passcode: data.passcode,
        activate_at: data.activate_at,
        expires_at: data.expires_at,
      });
      router.push('/create/confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <ProgressBar step={step} />
      <h2 className="mt-6 text-3xl font-semibold">{STEP_TITLES[step]}</h2>

      <div className="mt-8">
        {step === 1 && <StepOccasion onPick={(t) => { store.setType(t); setStep(2); }} />}
        {step === 2 && <StepBasics />}
        {step === 3 && <StepTheme />}
        {step === 4 && <StepContent />}
        {step === 5 && <StepTiming />}
        {step === 6 && <StepPreview />}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1}
          className="text-sm text-text-muted underline disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Back
        </button>
        {step < 6 && (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-accent-1 px-6 py-2 font-medium text-black hover:bg-accent-1/90"
          >
            Next →
          </button>
        )}
        {step === 6 && (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-accent-1 px-6 py-2 font-medium text-black hover:bg-accent-1/90 disabled:opacity-60"
          >
            {submitting ? 'Generating…' : 'Generate My Link'}
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------- Sub-components -------------------------- */

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex gap-1" aria-label={`Step ${step} of 6`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition ${
            i + 1 <= step ? 'bg-accent-1' : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

function StepOccasion({ onPick }: { onPick: (t: CelebrationType) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <OccasionCard emoji="🎂" title="Birthday" onClick={() => onPick('birthday')}>
        Fun, energetic, game-filled. Target: 15+ minutes.
      </OccasionCard>
      <OccasionCard emoji="💌" title="Expression" onClick={() => onPick('expression')}>
        Intimate, cinematic, emotional. Target: 7–8 minutes.
      </OccasionCard>
    </div>
  );
}

function OccasionCard({
  emoji,
  title,
  onClick,
  children,
}: {
  emoji: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-accent-1/60 hover:bg-white/10"
    >
      <span className="text-4xl" aria-hidden>{emoji}</span>
      <span className="text-xl font-semibold">{title}</span>
      <span className="text-sm text-text-muted">{children}</span>
    </button>
  );
}

function StepBasics() {
  const { basics, setBasics } = useCreatorFormStore();
  return (
    <div className="space-y-4">
      <Field label="Recipient's first name">
        <input
          className="input"
          value={basics.recipient_name}
          maxLength={100}
          onChange={(e) => setBasics({ recipient_name: e.target.value })}
        />
      </Field>
      <Field label="Your name / nickname">
        <input
          className="input"
          value={basics.creator_name}
          maxLength={100}
          onChange={(e) => setBasics({ creator_name: e.target.value })}
        />
      </Field>
      <Field label="Relationship">
        <select
          className="input"
          value={basics.relationship}
          onChange={(e) => setBasics({ relationship: e.target.value })}
        >
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function StepTheme() {
  const { type, theme, setTheme } = useCreatorFormStore();
  const themes = type === 'birthday' ? BIRTHDAY_THEMES : EXPRESSION_THEMES;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {themes.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          className={`rounded-xl border p-4 text-left transition ${
            theme === t
              ? 'border-accent-1 bg-white/10'
              : 'border-white/10 bg-white/5 hover:border-white/30'
          }`}
        >
          <div className={`mb-2 h-16 rounded-md bg-gradient-to-br theme-${t}`} style={themePreview(t)} />
          <div className="text-sm font-medium">{toTitle(t)}</div>
        </button>
      ))}
    </div>
  );
}

function themePreview(theme: string): React.CSSProperties {
  const presets: Record<string, [string, string]> = {
    'confetti-burst': ['#0a0a1a', '#ff3ea5'],
    'golden-glow': ['#1a1008', '#f5c56b'],
    'neon-night': ['#0a0015', '#ff00ff'],
    'starry-dream': ['#050520', '#8ab4ff'],
    'midnight-letters': ['#0a0a0f', '#e8c978'],
    'soft-bloom': ['#1a0a10', '#f3b0c3'],
    'warm-sunset': ['#1a0f08', '#f2a679'],
  };
  const pair = presets[theme] ?? ['#222', '#888'];
  return { background: `linear-gradient(135deg, ${pair[0]}, ${pair[1]})` };
}

function toTitle(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StepContent() {
  const { type } = useCreatorFormStore();
  return type === 'birthday' ? <BirthdayFields /> : <ExpressionFields />;
}

function BirthdayFields() {
  const { birthday, setBirthday, media, setMedia, draftToken } = useCreatorFormStore();
  return (
    <div className="space-y-6">
      <Field label={`Hero text (max 150 chars) — ${birthday.hero_text.length}/150`}>
        <input
          className="input"
          value={birthday.hero_text}
          maxLength={150}
          onChange={(e) => setBirthday({ hero_text: e.target.value })}
        />
      </Field>

      <ListField
        label="Reasons (5 to 10)"
        values={birthday.reasons}
        maxItems={10}
        minItems={5}
        maxChars={150}
        onChange={(v) => setBirthday({ reasons: v })}
      />

      <QuizEditor
        questions={birthday.quiz_questions}
        onChange={(q) => setBirthday({ quiz_questions: q })}
      />

      <Field label={`Final message (max 800 chars) — ${birthday.final_message.length}/800`}>
        <textarea
          className="input min-h-[10rem]"
          value={birthday.final_message}
          maxLength={800}
          onChange={(e) => setBirthday({ final_message: e.target.value })}
        />
      </Field>

      <PhotoUploader
        photos={media.photos}
        setPhotos={(p) => setMedia({ photos: p })}
        draftToken={draftToken}
        min={3}
        max={7}
      />

      <AudioUploader
        songUrl={media.song_url}
        setSongUrl={(s) => setMedia({ song_url: s })}
        draftToken={draftToken}
      />
    </div>
  );
}

function ExpressionFields() {
  const { expression, setExpression, media, setMedia, draftToken } = useCreatorFormStore();
  return (
    <div className="space-y-6">
      <Field label={`Confession message (max 1500 chars) — ${expression.confession_message.length}/1500`}>
        <textarea
          className="input min-h-[12rem]"
          value={expression.confession_message}
          maxLength={1500}
          onChange={(e) => setExpression({ confession_message: e.target.value })}
        />
      </Field>

      <ListField
        label="Things I notice (3 to 5)"
        values={expression.things_i_notice}
        maxItems={5}
        minItems={3}
        maxChars={150}
        onChange={(v) => setExpression({ things_i_notice: v })}
      />

      <Field label="Closing line">
        <select
          className="input"
          value={
            [
              'Will you be mine?',
              'I just wanted you to know',
              'What do you think?',
              "I've been meaning to tell you...",
            ].includes(expression.closing_line)
              ? expression.closing_line
              : '__custom__'
          }
          onChange={(e) => {
            const v = e.target.value;
            setExpression({ closing_line: v === '__custom__' ? '' : v });
          }}
        >
          <option>Will you be mine?</option>
          <option>I just wanted you to know</option>
          <option>What do you think?</option>
          <option>I&apos;ve been meaning to tell you...</option>
          <option value="__custom__">Custom…</option>
        </select>
        <input
          className="input mt-2"
          placeholder="Write your own closing line"
          value={expression.closing_line}
          maxLength={200}
          onChange={(e) => setExpression({ closing_line: e.target.value })}
        />
      </Field>

      <PhotoUploader
        photos={media.photos}
        setPhotos={(p) => setMedia({ photos: p })}
        draftToken={draftToken}
        min={2}
        max={4}
      />

      <AudioUploader
        songUrl={media.song_url}
        setSongUrl={(s) => setMedia({ song_url: s })}
        draftToken={draftToken}
      />
    </div>
  );
}

function ListField({
  label,
  values,
  maxItems,
  minItems,
  maxChars,
  onChange,
}: {
  label: string;
  values: string[];
  maxItems: number;
  minItems: number;
  maxChars: number;
  onChange: (v: string[]) => void;
}) {
  return (
    <Field label={label}>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input flex-1"
              value={v}
              maxLength={maxChars}
              onChange={(e) => {
                const copy = values.slice();
                copy[i] = e.target.value;
                onChange(copy);
              }}
            />
            {values.length > minItems && (
              <button
                type="button"
                className="text-sm text-red-300 hover:underline"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {values.length < maxItems && (
          <button
            type="button"
            className="text-sm text-accent-1 underline"
            onClick={() => onChange([...values, ''])}
          >
            + Add another
          </button>
        )}
      </div>
    </Field>
  );
}

function QuizEditor({
  questions,
  onChange,
}: {
  questions: QuizQuestionDraft[];
  onChange: (q: QuizQuestionDraft[]) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        5 quiz questions. Each has 4 options; mark the correct one.
      </p>
      {questions.map((q, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm font-medium">Question {i + 1}</div>
          <input
            className="input"
            value={q.prompt}
            maxLength={300}
            placeholder="Prompt"
            onChange={(e) => {
              const copy = questions.slice();
              copy[i] = { ...q, prompt: e.target.value };
              onChange(copy);
            }}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, oi) => (
              // eslint-disable-next-line jsx-a11y/label-has-associated-control
              <label key={oi} className="flex items-center gap-2 rounded border border-white/10 bg-black/30 px-2 py-1">
                <input
                  type="radio"
                  name={`correct-${i}`}
                  aria-label={`Mark option ${oi + 1} as correct`}
                  checked={q.correctIndex === oi}
                  onChange={() => {
                    const copy = questions.slice();
                    copy[i] = { ...q, correctIndex: oi as 0 | 1 | 2 | 3 };
                    onChange(copy);
                  }}
                />
                <input
                  className="input flex-1"
                  value={opt}
                  maxLength={150}
                  placeholder={`Option ${oi + 1}`}
                  onChange={(e) => {
                    const copy = questions.slice();
                    const opts = q.options.slice() as [string, string, string, string];
                    opts[oi] = e.target.value;
                    copy[i] = { ...q, options: opts };
                    onChange(copy);
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PhotoUploader({
  photos,
  setPhotos,
  draftToken,
  min,
  max,
}: {
  photos: PhotoRow[];
  setPhotos: (p: PhotoRow[]) => void;
  draftToken: string;
  min: number;
  max: number;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (photos.length >= max) {
      setErr(`Maximum ${max} photos.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const blob = await compressImageToWebp(file);
      const index = photos.length + 1;
      const signed = await fetch('/api/upload/photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          shortCodeDraft: draftToken,
          index,
          contentType: 'image/webp',
        }),
      }).then((r) => r.json());
      if (!signed?.uploadUrl) throw new Error(signed?.error?.message ?? 'Upload failed');
      const putRes = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/webp' },
        body: blob,
      });
      if (!putRes.ok) throw new Error('Upload failed');
      setPhotos([...photos, { url: signed.publicUrl, caption: '', order: index }]);
    } catch (e) {
      setErr(e instanceof ImageTooLargeError ? e.message : 'Could not upload photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={`Photos (${min}–${max}) — ${photos.length}/${max}`}>
      <div className="space-y-2">
        {photos.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded border border-white/10 bg-white/5 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-16 w-16 rounded object-cover" />
            <input
              className="input flex-1"
              placeholder="Caption (optional)"
              value={p.caption}
              maxLength={100}
              onChange={(e) => {
                const copy = photos.slice();
                copy[i] = { ...p, caption: e.target.value };
                setPhotos(copy);
              }}
            />
            <button
              type="button"
              className="text-sm text-red-300 hover:underline"
              onClick={() => setPhotos(photos.filter((_, idx) => idx !== i).map((ph, idx) => ({ ...ph, order: idx + 1 })))}
            >
              Remove
            </button>
          </div>
        ))}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-white/20 px-3 py-2 text-sm text-text-muted hover:bg-white/5">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePick} hidden />
          {busy ? 'Uploading…' : photos.length < max ? '+ Add photo' : `Max ${max} reached`}
        </label>
        {err && <p className="text-sm text-red-300">{err}</p>}
      </div>
    </Field>
  );
}

function AudioUploader({
  songUrl,
  setSongUrl,
  draftToken,
}: {
  songUrl: string | null;
  setSongUrl: (s: string | null) => void;
  draftToken: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 5 * 1024 * 1024) {
      setErr('Audio must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const signed = await fetch('/api/upload/audio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shortCodeDraft: draftToken, contentType: file.type }),
      }).then((r) => r.json());
      if (!signed?.uploadUrl) throw new Error(signed?.error?.message ?? 'Upload failed');
      const putRes = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('Upload failed');
      setSongUrl(signed.publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not upload audio.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Field label="Background music (optional)">
      {songUrl ? (
        <div className="flex items-center gap-3 rounded border border-white/10 bg-white/5 p-2">
          <audio controls src={songUrl} className="flex-1">
            <track kind="captions" />
          </audio>
          <button
            type="button"
            className="text-sm text-red-300 hover:underline"
            onClick={() => setSongUrl(null)}
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-white/20 px-3 py-2 text-sm text-text-muted hover:bg-white/5">
          <input type="file" accept="audio/mpeg,audio/mp4" onChange={pick} hidden />
          {busy ? 'Uploading…' : '+ Upload MP3/M4A (5 MB max)'}
        </label>
      )}
      {err && <p className="text-sm text-red-300">{err}</p>}
    </Field>
  );
}

function StepTiming() {
  const { timing, setTiming } = useCreatorFormStore();
  const minLocal = useMemo(() => {
    const d = new Date(Date.now() + 16 * 60 * 1000); // 16 min to be safe vs server's 15-min cutoff
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  const expires = useMemo(() => {
    if (!timing.activate_at) return null;
    const t = Date.parse(timing.activate_at);
    if (Number.isNaN(t)) return null;
    return new Date(t + 21 * 60 * 60 * 1000).toLocaleString();
  }, [timing.activate_at]);

  return (
    <div className="space-y-4">
      <Field label="4-digit passcode">
        <input
          className="input"
          value={timing.passcode}
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]{4}"
          onChange={(e) => setTiming({ passcode: e.target.value.replace(/\D/g, '') })}
        />
      </Field>
      <Field label="Confirm passcode">
        <input
          className="input"
          value={timing.passcodeConfirm}
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]{4}"
          onChange={(e) => setTiming({ passcodeConfirm: e.target.value.replace(/\D/g, '') })}
        />
      </Field>
      <Field label="Activation date & time (at least 15 min from now)">
        <input
          type="datetime-local"
          className="input"
          min={minLocal}
          value={timing.activate_at}
          onChange={(e) => setTiming({ activate_at: e.target.value })}
        />
      </Field>
      {expires && (
        <p className="text-sm text-text-muted">
          Will be viewable until <strong>{expires}</strong> — exactly 21 hours from your activation
          time.
        </p>
      )}
      <p className="text-sm text-text-muted">
        Tell them to screen-record the experience! It&apos;s only available for 21 hours.
      </p>
    </div>
  );
}

function StepPreview() {
  const store = useCreatorFormStore();
  return (
    <div className="space-y-4">
      <p className="text-text-muted">
        Review your celebration. The full cinematic preview arrives in a later update; for now,
        here&apos;s a summary of what we&apos;ll save:
      </p>
      <SummaryLine label="Occasion" value={store.type ?? ''} />
      <SummaryLine label="Theme" value={store.theme ?? ''} />
      <SummaryLine
        label="Recipient"
        value={`${store.basics.recipient_name} (${store.basics.relationship})`}
      />
      <SummaryLine label="From" value={store.basics.creator_name} />
      <SummaryLine
        label="Activation"
        value={store.timing.activate_at ? new Date(store.timing.activate_at).toLocaleString() : '—'}
      />
      <SummaryLine label="Photos" value={String(store.media.photos.length)} />
      {store.media.song_url && <SummaryLine label="Music" value="Attached" />}
      <p className="text-sm text-text-muted">
        On submit, your celebration is created with status <strong>pending</strong>. Message us on
        Instagram to confirm, then we approve it — and only then the recipient can open it.
      </p>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-white/10 py-2 text-sm">
      <span className="text-text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-text-muted">{label}</span>
      {children}
    </label>
  );
}

/* -------------------------- Validation -------------------------- */

function validateStep(step: Step, store: ReturnType<typeof useCreatorFormStore.getState>): string | null {
  if (step === 1 && !store.type) return 'Pick an occasion to continue.';
  if (step === 2) {
    const { recipient_name, creator_name, relationship } = store.basics;
    if (!recipient_name.trim() || !creator_name.trim() || !relationship.trim()) {
      return "Fill in all three fields to continue.";
    }
  }
  if (step === 3 && !store.theme) return 'Pick a theme to continue.';
  if (step === 4) {
    if (store.type === 'birthday') {
      const b = store.birthday;
      if (!b.hero_text.trim()) return 'Hero text is required.';
      if (b.reasons.filter((r) => r.trim()).length < 5) return 'At least 5 reasons.';
      for (const q of b.quiz_questions) {
        if (!q.prompt.trim() || q.options.some((o) => !o.trim())) {
          return 'Every quiz question needs a prompt and 4 non-empty options.';
        }
      }
      if (!b.final_message.trim()) return 'Final message is required.';
      if (store.media.photos.length < 3) return 'At least 3 photos.';
    } else if (store.type === 'expression') {
      const e = store.expression;
      if (!e.confession_message.trim()) return 'Confession message is required.';
      if (e.things_i_notice.filter((t) => t.trim()).length < 3) return 'At least 3 noticings.';
      if (!e.closing_line.trim()) return 'Closing line is required.';
      if (store.media.photos.length < 2) return 'At least 2 photos.';
    }
  }
  if (step === 5) {
    const { passcode, passcodeConfirm, activate_at } = store.timing;
    if (!/^[0-9]{4}$/.test(passcode)) return 'Passcode must be exactly 4 digits.';
    if (passcode !== passcodeConfirm) return 'Passcodes do not match.';
    const ms = Date.parse(activate_at);
    if (Number.isNaN(ms)) return 'Pick an activation date and time.';
    if (ms < Date.now() + 15 * 60 * 1000) return 'Activation time must be at least 15 minutes from now.';
  }
  return null;
}

function buildSubmitPayload(store: ReturnType<typeof useCreatorFormStore.getState>) {
  const activateIso = new Date(store.timing.activate_at).toISOString();
  const base = {
    theme: store.theme!,
    recipient_name: store.basics.recipient_name.trim(),
    creator_name: store.basics.creator_name.trim(),
    relationship: store.basics.relationship,
    passcode: store.timing.passcode,
    activate_at: activateIso,
    song_url: store.media.song_url,
    photos: store.media.photos,
  };
  if (store.type === 'birthday') {
    return {
      ...base,
      type: 'birthday',
      hero_text: store.birthday.hero_text.trim(),
      reasons: store.birthday.reasons.filter((r) => r.trim()),
      quiz_questions: store.birthday.quiz_questions,
      final_message: store.birthday.final_message.trim(),
    };
  }
  return {
    ...base,
    type: 'expression',
    confession_message: store.expression.confession_message.trim(),
    things_i_notice: store.expression.things_i_notice.filter((t) => t.trim()),
    closing_line: store.expression.closing_line.trim(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _fieldTailwind = publicEnv; // silence tree-shake
