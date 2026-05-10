/**
 * Landing page — public marketing / entry point.
 *
 * Two CTAs pre-select the occasion on /create. The hero copy explains what
 * the product is in two sentences and points at the creator form.
 */

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-a text-text-primary">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b0b0f] via-[#18121f] to-[#1a0f08]" />
      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-accent-1/30 bg-white/5 px-4 py-1.5 text-sm text-accent-1">
          <span aria-hidden>✨</span>
          <span>A gift, not a greeting card</span>
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Make someone&rsquo;s day unforgettable.
        </h1>
        <p className="max-w-xl text-lg text-text-muted">
          Create a personalized, cinematic surprise in minutes. Share a link. Watch them
          smile. Their experience opens at a time you choose, for exactly 21 hours.
        </p>

        <div className="mt-4 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          <Link
            href="/create?type=birthday"
            className="group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-accent-1/60 hover:bg-white/10"
          >
            <span className="text-3xl" aria-hidden>🎂</span>
            <span className="text-xl font-semibold">Birthday Surprise</span>
            <span className="text-sm text-text-muted">
              A 15-minute scroll-driven journey. Photos, reasons, quiz, confetti finale.
            </span>
            <span className="mt-2 text-sm text-accent-1 group-hover:underline">
              Start a birthday →
            </span>
          </Link>

          <Link
            href="/create?type=expression"
            className="group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-accent-2/60 hover:bg-white/10"
          >
            <span className="text-3xl" aria-hidden>💌</span>
            <span className="text-xl font-semibold">Express Your Feelings</span>
            <span className="text-sm text-text-muted">
              A 7-minute intimate letter. Photos, confession, reply canvas.
            </span>
            <span className="mt-2 text-sm text-accent-2 group-hover:underline">
              Start an expression →
            </span>
          </Link>
        </div>

        <section className="mt-16 grid w-full max-w-3xl gap-6 sm:grid-cols-3" aria-label="How it works">
          <Step n={1} title="Fill the form">
            Upload photos, write your message, pick a theme and a passcode.
          </Step>
          <Step n={2} title="We approve it">
            Message us on Instagram; we confirm and activate your celebration.
          </Step>
          <Step n={3} title="They experience it">
            Share the link and passcode. It unlocks at your chosen time, for 21 hours.
          </Step>
        </section>

        <footer className="mt-16 text-xs text-text-muted">
          <span>Made with care. Data is private per-celebration. </span>
          <Link href="/create" className="underline hover:text-text-primary">
            Create your first one →
          </Link>
          <div className="mt-4 flex justify-center gap-4 text-[10px] uppercase tracking-[0.2em] opacity-60">
            <Link href="/preview/birthday" className="underline hover:text-text-primary">
              Preview birthday
            </Link>
            <Link href="/preview/expression" className="underline hover:text-text-primary">
              Preview expression
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-white/5 bg-white/5 p-5 text-left">
      <span className="text-xs text-accent-1">Step {n}</span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-text-muted">{children}</p>
    </div>
  );
}
