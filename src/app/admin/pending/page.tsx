/**
 * /admin/pending — dedicated view for the pending approval queue.
 *
 * This is a lightweight wrapper around the admin list that pre-filters to
 * status=pending and sorts by activate_at ascending so the soonest-starting
 * celebrations sit at the top. Each row shows the key decision data
 * (recipient, creator, relationship, activation time, short code) plus
 * inline Approve/Reject buttons.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type PendingRow = {
  id: string;
  short_code: string;
  type: 'birthday' | 'expression';
  theme: string;
  recipient_name: string;
  creator_name: string;
  relationship: string;
  activate_at: string;
  expires_at: string;
  created_at: string;
};

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : '';
}

async function mutate(url: string, body?: unknown): Promise<void> {
  const init: RequestInit = {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': getCookie('ct_csrf'),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data?.error?.message ?? 'Request failed.');
  }
}

export default function PendingApprovalsPage() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      '/api/admin/celebrations?status=pending&sort=activate_at&order=asc&pageSize=100',
      { credentials: 'same-origin' },
    );
    const data = await res.json();
    setRows(data.rows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="min-h-screen bg-bg-a text-text-primary">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-text-muted hover:underline">
              ← Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">
              Pending approvals ({rows.length})
            </h1>
            <p className="text-sm text-text-muted">
              Sorted by activation time. Approve the soonest-starting celebrations first.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm hover:bg-white/5"
          >
            Refresh
          </button>
        </header>

        {loading && <p className="text-text-muted">Loading…</p>}

        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-text-muted">
            🎉 No pending celebrations. Great work.
          </div>
        )}

        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{row.type === 'birthday' ? '🎂' : '💌'}</span>
                    <span className="font-mono text-xs text-text-muted">{row.short_code}</span>
                    <span className="rounded border border-white/10 bg-black/40 px-2 py-0.5 text-xs">
                      {row.theme}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">
                    For {row.recipient_name} ({row.relationship})
                  </h2>
                  <p className="text-sm text-text-muted">
                    From {row.creator_name} · Created {fmt(row.created_at)}
                  </p>
                  <p className="mt-1 text-sm">
                    <strong>Activation:</strong> {fmt(row.activate_at)}
                    <span className="text-text-muted"> · expires {fmt(row.expires_at)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await mutate(`/api/admin/celebrations/${row.id}/approve`);
                      void refresh();
                    }}
                    className="rounded border border-green-400/40 bg-green-400/10 px-4 py-1.5 text-sm text-green-200 hover:bg-green-400/20"
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const notes = prompt('Optional reject note (leave blank to skip):') ?? '';
                      await mutate(
                        `/api/admin/celebrations/${row.id}/reject`,
                        notes ? { admin_notes: notes } : {},
                      );
                      void refresh();
                    }}
                    className="rounded border border-red-400/40 bg-red-400/10 px-4 py-1.5 text-sm text-red-200 hover:bg-red-400/20"
                  >
                    ✗ Reject
                  </button>
                  <Link
                    href={`/admin/celebrations/${row.id}`}
                    className="rounded border border-white/15 bg-black/30 px-4 py-1.5 text-sm hover:bg-white/5"
                  >
                    Details →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}
