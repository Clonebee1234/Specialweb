/**
 * Post-submission confirmation screen (Req 29).
 *
 * Displays:
 *   - "Awaiting approval" banner explicitly telling the creator to message us.
 *   - Shareable link + passcode with copy-to-clipboard buttons.
 *   - Instagram contact button driven entirely by env vars.
 *   - Pre-filled message template ending with an explicit approval request.
 *
 * We read the one-time submit result from the Zustand store; on refresh, the
 * result is gone (sessionStorage clears the submitResult when the user
 * navigates back through /create).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreatorFormStore } from '@/lib/state/useCreatorFormStore';
import { publicEnv } from '@/lib/env';

export function ConfirmationScreen() {
  const router = useRouter();
  const { submitResult, basics, reset } = useCreatorFormStore();
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!submitResult) {
      // No fresh submit result — send them back.
      router.replace('/create');
    }
  }, [submitResult, router]);

  if (!submitResult) return null;

  const link = `${origin || publicEnv.NEXT_PUBLIC_APP_URL}/c/${submitResult.shortCode}`;
  const activationLocal = new Date(submitResult.activate_at).toLocaleString();
  const instagramUrl = publicEnv.NEXT_PUBLIC_ADMIN_INSTAGRAM_URL?.trim();
  const instagramHandle = publicEnv.NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE?.trim();

  const messageTemplate = [
    `Hi! I just submitted a celebration on CelebrateThem.`,
    `Recipient: ${basics.recipient_name}`,
    `From: ${basics.creator_name}`,
    `Activation time: ${activationLocal}`,
    `Short code: ${submitResult.shortCode}`,
    `Payment is being arranged.`,
    `Please approve my celebration so I can share it.`,
  ].join('\n');

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <div className="rounded-2xl border border-accent-1/40 bg-accent-1/5 p-6">
        <h1 className="text-2xl font-semibold">Awaiting approval ⏳</h1>
        <p className="mt-2 text-text-muted">
          Please message our admin to approve your request. Your link will not work for{' '}
          <strong className="text-text-primary">{basics.recipient_name}</strong> until we approve
          it. Once approved, it will activate at{' '}
          <strong className="text-text-primary">{activationLocal}</strong> and remain viewable for
          exactly 21 hours.
        </p>
      </div>

      <section className="mt-8 space-y-4">
        <CopyBlock label="Shareable link" value={link} />
        <CopyBlock label="Passcode" value={submitResult.passcode} mono />
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Step 2 — Ping us on Instagram</h2>
        {instagramUrl ? (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-2 px-5 py-2.5 font-medium text-black hover:bg-accent-2/90"
          >
            Message us on Instagram to confirm your celebration →
          </a>
        ) : (
          <p className="text-sm text-text-muted">Instagram contact not configured.</p>
        )}
        {instagramHandle && (
          <p className="text-sm text-text-muted">DM us at {instagramHandle}</p>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Copy this message</h2>
        <textarea
          readOnly
          className="input min-h-[12rem] font-mono text-sm"
          value={messageTemplate}
        />
        <CopyButton value={messageTemplate} label="Copy message" />
      </section>

      <div className="mt-10 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-text-muted">
        Please don&apos;t share the link with {basics.recipient_name} until we confirm approval.
      </div>

      <div className="mt-8 flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-accent-1 underline"
          onClick={() => {
            reset();
            router.push('/create');
          }}
        >
          Create another celebration →
        </button>
        <Link href="/" className="text-text-muted hover:underline">
          Back home
        </Link>
      </div>
    </div>
  );
}

function CopyBlock({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-text-muted">{label}</div>
      <div className="flex items-center gap-3">
        <code className={`flex-1 break-all ${mono ? 'text-2xl tracking-[0.5em]' : ''}`}>
          {value}
        </code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Fallback for older browsers
          const ta = document.createElement('textarea');
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }
      }}
      className="rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm hover:bg-white/5"
    >
      {copied ? '✓ Copied' : (label ?? 'Copy')}
    </button>
  );
}
