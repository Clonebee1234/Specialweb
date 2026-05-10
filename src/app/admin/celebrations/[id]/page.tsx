/**
 * /admin/celebrations/[id] — single-celebration detail view.
 *
 * Shows the full row, the approval banner for pending rows, raw content
 * fields, photo gallery with per-photo delete, and the expression reply
 * (with image generation via the pure `renderReplyImage` function).
 *
 * All mutations go through the admin API using the double-submit CSRF
 * token already issued at /api/admin/login.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { renderReplyImage, type ReplyImageTheme } from '@/lib/canvas/replyImage';
import { browserCanvasAdapter } from '@/lib/canvas/adapter.browser';

type Row = {
  id: string;
  short_code: string;
  type: 'birthday' | 'expression';
  status: 'pending' | 'active' | 'inactive' | 'deleted';
  theme: string;
  recipient_name: string;
  creator_name: string;
  relationship: string;
  song_url: string | null;
  photos: Array<{ url: string; caption: string; order: number }>;
  hero_text: string | null;
  reasons: string[] | null;
  quiz_questions: Array<{ prompt: string; options: [string, string, string, string]; correctIndex: number }> | null;
  final_message: string | null;
  confession_message: string | null;
  things_i_notice: string[] | null;
  closing_line: string | null;
  expression_reply: string | null;
  expression_reply_downloaded: boolean;
  activate_at: string;
  expires_at: string;
  created_at: string;
  approved_at: string | null;
  admin_notes: string | null;
  times_reactivated: number;
  view_count: number;
};

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : '';
}

async function call<T>(url: string, method: string, body?: unknown): Promise<T | null> {
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': getCookie('ct_csrf'),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data?.error?.message ?? 'Request failed.');
    return null;
  }
  return data as T;
}

export default function AdminDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await call<{ row: Row }>(`/api/admin/celebrations/${id}`, 'GET');
    if (data) setRow(data.row);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <main className="p-8 text-text-muted">Loading…</main>;
  if (!row) return <main className="p-8 text-text-muted">Not found.</main>;
  const current = row; // narrow once for closures below

  async function approve() {
    await call(`/api/admin/celebrations/${current.id}/approve`, 'POST');
    await refresh();
  }
  async function reject() {
    const notes = prompt('Optional reject note:') ?? '';
    await call(`/api/admin/celebrations/${current.id}/reject`, 'POST', notes ? { admin_notes: notes } : {});
    await refresh();
  }
  async function toggle() {
    const target = current.status === 'active' ? 'inactive' : 'active';
    await call(`/api/admin/celebrations/${current.id}`, 'PATCH', { status: target });
    await refresh();
  }
  async function extend() {
    const hours = Number(prompt('Extend by how many hours?', '24'));
    if (!Number.isFinite(hours) || hours <= 0) return;
    await call(`/api/admin/celebrations/${current.id}`, 'PATCH', { extend_hours: hours });
    await refresh();
  }
  async function resetPasscode() {
    if (!confirm('This will invalidate the current passcode and any active unlock sessions. Continue?')) {
      return;
    }
    const data = await call<{ passcode: string }>(
      `/api/admin/celebrations/${current.id}/reset-passcode`,
      'POST',
    );
    if (data?.passcode) {
      alert(`New passcode: ${data.passcode}\n\nShare it with the creator now — it won't be shown again.`);
    }
    await refresh();
  }
  async function deletePhoto(idx: number) {
    if (!confirm('Delete this photo?')) return;
    await call(`/api/admin/celebrations/${current.id}/photos/${idx}`, 'DELETE');
    await refresh();
  }
  async function permDelete() {
    const echo = prompt(`Type ${current.short_code} to confirm permanent deletion:`);
    if (echo !== current.short_code) return;
    const ok = await call(`/api/admin/celebrations/${current.id}`, 'DELETE', {
      confirmShortCode: current.short_code,
    });
    if (ok) router.push('/admin');
  }
  async function markReplyDownloaded() {
    await call(`/api/admin/celebrations/${current.id}/reply/mark-downloaded`, 'POST');
    await refresh();
  }

  return (
    <main className="min-h-screen bg-bg-a text-text-primary">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <header className="flex items-start justify-between">
          <div>
            <Link href="/admin" className="text-sm text-text-muted hover:underline">
              ← All celebrations
            </Link>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
              <span>{row.type === 'birthday' ? '🎂' : '💌'}</span>
              <span>For {row.recipient_name}</span>
              <span className="font-mono text-xs text-text-muted">{row.short_code}</span>
            </h1>
            <p className="text-sm text-text-muted">
              From {row.creator_name} · {row.relationship} · theme: {row.theme}
            </p>
          </div>
          <StatusPill status={row.status} />
        </header>

        {row.status === 'pending' && (
          <div className="rounded-xl border-2 border-yellow-400/40 bg-yellow-400/10 p-5">
            <h2 className="text-lg font-semibold">Pending approval</h2>
            <p className="mt-1 text-sm text-text-muted">
              This celebration is locked from the recipient. Approve to release it, or reject to
              mark as inactive.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={approve}
                className="rounded bg-green-500/20 px-5 py-2 text-sm font-medium text-green-100 hover:bg-green-500/30"
              >
                ✓ Approve
              </button>
              <button
                type="button"
                onClick={reject}
                className="rounded bg-red-500/20 px-5 py-2 text-sm font-medium text-red-100 hover:bg-red-500/30"
              >
                ✗ Reject
              </button>
            </div>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2">
          <Stat label="Activate at" value={fmt(row.activate_at)} />
          <Stat label="Expires at" value={fmt(row.expires_at)} />
          <Stat label="Created" value={fmt(row.created_at)} />
          <Stat label="Approved" value={row.approved_at ? fmt(row.approved_at) : '—'} />
          <Stat label="Views" value={String(row.view_count)} />
          <Stat label="Extensions" value={String(row.times_reactivated)} />
        </section>

        <section className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
          {row.status !== 'pending' && row.status !== 'deleted' && (
            <button onClick={toggle} className="btn-action">
              {row.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          )}
          <button onClick={extend} className="btn-action">
            Extend hours
          </button>
          <button onClick={resetPasscode} className="btn-action">
            Reset passcode
          </button>
          <CopyLink shortCode={row.short_code} />
          <button onClick={permDelete} className="btn-action-danger">
            Delete permanently
          </button>
        </section>

        {row.admin_notes && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-text-muted">Admin notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{row.admin_notes}</p>
          </section>
        )}

        <PhotoGallery photos={row.photos} onDelete={deletePhoto} />

        {row.type === 'birthday' && <BirthdayContent row={row} />}
        {row.type === 'expression' && <ExpressionContent row={row} />}

        {row.type === 'expression' && row.expression_reply && (
          <ReplyBlock
            text={row.expression_reply}
            recipientName={row.recipient_name}
            theme={row.theme}
            downloaded={row.expression_reply_downloaded}
            onDownloaded={markReplyDownloaded}
          />
        )}
      </div>

      <style jsx>{`
        :global(.btn-action) {
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(0, 0, 0, 0.3);
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }
        :global(.btn-action:hover) {
          background: rgba(255, 255, 255, 0.05);
        }
        :global(.btn-action-danger) {
          border: 1px solid rgba(248, 113, 113, 0.4);
          background: rgba(248, 113, 113, 0.1);
          color: rgba(254, 202, 202, 1);
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }
        :global(.btn-action-danger:hover) {
          background: rgba(248, 113, 113, 0.2);
        }
      `}</style>
    </main>
  );
}

function StatusPill({ status }: { status: Row['status'] }) {
  const map: Record<Row['status'], string> = {
    pending: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-200',
    active: 'border-green-400/40 bg-green-400/10 text-green-200',
    inactive: 'border-gray-400/30 bg-white/5 text-text-muted',
    deleted: 'border-red-400/40 bg-red-400/10 text-red-200',
  };
  return (
    <span className={`inline-flex items-center rounded border px-3 py-1 text-xs ${map[status]}`}>
      {status}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function CopyLink({ shortCode }: { shortCode: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/c/${shortCode}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="btn-action"
    >
      {copied ? '✓ Copied' : 'Copy link'}
    </button>
  );
}

function PhotoGallery({
  photos,
  onDelete,
}: {
  photos: Row['photos'];
  onDelete: (idx: number) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-text-muted">Photos</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, idx) => (
          <figure
            key={idx}
            className="overflow-hidden rounded-lg border border-white/10 bg-white/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption || `photo ${idx + 1}`} className="aspect-square w-full object-cover" />
            {p.caption && (
              <figcaption className="p-2 text-xs text-text-muted">{p.caption}</figcaption>
            )}
            <button
              type="button"
              onClick={() => onDelete(idx)}
              className="block w-full border-t border-white/10 bg-red-500/10 py-1 text-xs text-red-200 hover:bg-red-500/20"
            >
              Delete
            </button>
          </figure>
        ))}
      </div>
    </section>
  );
}

function BirthdayContent({ row }: { row: Row }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-text-muted">Content</h3>
      {row.hero_text && <TextBlock title="Hero text" text={row.hero_text} />}
      {row.reasons && (
        <TextBlock title={`Reasons (${row.reasons.length})`} text={row.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')} />
      )}
      {row.final_message && <TextBlock title="Final message" text={row.final_message} />}
      {row.quiz_questions && (
        <TextBlock
          title="Quiz"
          text={row.quiz_questions
            .map((q, i) => {
              const options = q.options
                .map((o, oi) => `  ${oi === q.correctIndex ? '✓' : ' '} ${o}`)
                .join('\n');
              return `${i + 1}. ${q.prompt}\n${options}`;
            })
            .join('\n\n')}
        />
      )}
    </section>
  );
}

function ExpressionContent({ row }: { row: Row }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-text-muted">Content</h3>
      {row.confession_message && <TextBlock title="Confession" text={row.confession_message} />}
      {row.things_i_notice && (
        <TextBlock title="Things I notice" text={row.things_i_notice.map((t) => `• ${t}`).join('\n')} />
      )}
      {row.closing_line && <TextBlock title="Closing line" text={row.closing_line} />}
    </section>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <details className="rounded-lg border border-white/10 bg-white/5 p-3" open>
      <summary className="cursor-pointer text-sm text-text-muted">{title}</summary>
      <p className="mt-2 whitespace-pre-wrap text-sm">{text}</p>
    </details>
  );
}

function ReplyBlock({
  text,
  recipientName,
  theme,
  downloaded,
  onDownloaded,
}: {
  text: string;
  recipientName: string;
  theme: string;
  downloaded: boolean;
  onDownloaded: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const replyTheme = useMemo<ReplyImageTheme>(() => {
    if (theme === 'midnight-letters' || theme === 'soft-bloom' || theme === 'warm-sunset') {
      return theme;
    }
    return 'midnight-letters';
  }, [theme]);

  async function generateImage(download: boolean) {
    const bytes = await renderReplyImage(
      {
        replyText: text,
        recipientFirstName: recipientName,
        dateIso: new Date().toISOString(),
        theme: replyTheme,
      },
      browserCanvasAdapter,
    );
    // Uint8Array is a valid BlobPart at runtime; TS's narrower type requires a cast.
    const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    setPreview(url);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `reply-${recipientName.replace(/\s+/g, '_')}.png`;
      a.click();
      if (!downloaded) onDownloaded();
    }
  }

  return (
    <section className="rounded-xl border border-accent-2/40 bg-accent-2/5 p-4">
      <h3 className="text-lg font-semibold">
        Recipient reply {downloaded && <span className="text-xs text-text-muted">(downloaded)</span>}
      </h3>
      <p className="mt-2 whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-3 font-serif italic">
        {text}
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => generateImage(false)} className="btn-action">
          Generate image preview
        </button>
        <button onClick={() => generateImage(true)} className="btn-action">
          Download PNG
        </button>
      </div>
      {preview && (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-w-xs rounded border border-white/10" />
        </div>
      )}
    </section>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}
