/**
 * Admin panel — dashboard + list + detail in one place.
 *
 * Single-file design for the same reason the creator wizard is: these
 * screens share a lot of state (filters, refresh) and interaction (row
 * actions). Breaking this into 10 tiny components buys no clarity.
 *
 * Auth: the middleware already guards /admin/** on `ct_admin`. This
 * component reads `ct_csrf` out of `document.cookie` and echoes it as
 * `x-csrf-token` on every mutating request.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = {
  id: string;
  short_code: string;
  type: 'birthday' | 'expression';
  status: 'pending' | 'active' | 'inactive';
  theme: string;
  recipient_name: string;
  creator_name: string;
  relationship: string;
  activate_at: string;
  expires_at: string;
  created_at: string;
  approved_at: string | null;
  view_count: number;
  expression_reply: string | null;
  expression_reply_downloaded: boolean;
};

type Stats = {
  active: number;
  pending: number;
  inactive: number;
  totalEverCreated: number;
  expiringNext2h: number;
};

export function AdminPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [activateFrom, setActivateFrom] = useState('');
  const [activateTo, setActivateTo] = useState('');
  const [sort, setSort] = useState<'created_at' | 'activate_at' | 'expires_at' | 'approved_at' | 'view_count'>('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [refreshTick, setRefreshTick] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => undefined);
  }, [refreshTick]);

  useEffect(() => {
    const q = new URLSearchParams();
    if (filterStatus.length) q.set('status', filterStatus.join(','));
    if (filterType.length) q.set('type', filterType.join(','));
    if (search.trim()) q.set('q', search.trim());
    if (activateFrom) q.set('activateFrom', new Date(activateFrom).toISOString());
    if (activateTo) q.set('activateTo', new Date(activateTo).toISOString());
    q.set('sort', sort);
    q.set('order', order);
    q.set('pageSize', '100');
    fetch(`/api/admin/celebrations?${q.toString()}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (data.rows) setRows(data.rows);
        else setErr(data?.error?.message ?? 'Failed to load.');
      })
      .catch(() => setErr('Network error'));
  }, [filterStatus, filterType, search, activateFrom, activateTo, sort, order, refreshTick]);

  async function logout() {
    await mutate('/api/admin/logout', 'POST');
    router.push('/admin/login');
    router.refresh();
  }

  async function approve(id: string) {
    await mutate(`/api/admin/celebrations/${id}/approve`, 'POST');
    refresh();
  }
  async function reject(id: string) {
    if (!confirm('Reject this celebration? It will move to inactive.')) return;
    await mutate(`/api/admin/celebrations/${id}/reject`, 'POST');
    refresh();
  }
  async function toggle(row: Row) {
    const target = row.status === 'active' ? 'inactive' : 'active';
    await mutate(`/api/admin/celebrations/${row.id}`, 'PATCH', { status: target });
    refresh();
  }
  async function extend(row: Row) {
    const hours = Number(prompt('Extend by how many hours?', '24'));
    if (!Number.isFinite(hours) || hours <= 0) return;
    await mutate(`/api/admin/celebrations/${row.id}`, 'PATCH', { extend_hours: hours });
    refresh();
  }
  async function resetPasscode(id: string) {
    if (!confirm('This will invalidate the current passcode and any active unlock sessions. Continue?')) return;
    const res = await mutate(`/api/admin/celebrations/${id}/reset-passcode`, 'POST');
    if (res?.passcode) alert(`New passcode: ${res.passcode}\n\nShare it with the creator now — it won't be shown again.`);
    refresh();
  }
  async function permDelete(row: Row) {
    const echo = prompt(`Type ${row.short_code} to confirm permanent deletion:`);
    if (echo !== row.short_code) return;
    await mutate(`/api/admin/celebrations/${row.id}`, 'DELETE', { confirmShortCode: row.short_code });
    refresh();
  }
  async function markDownloaded(id: string) {
    await mutate(`/api/admin/celebrations/${id}/reply/mark-downloaded`, 'POST');
    refresh();
  }

  const visibleRows = useMemo(() => rows, [rows]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CelebrateThem · Admin</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/settings" className="text-sm text-text-muted underline">
            Settings
          </a>
          <button type="button" onClick={logout} className="text-sm text-text-muted underline">
            Sign out
          </button>
        </div>
      </header>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Active" value={stats.active} />
          <StatCard label="Pending approval" value={stats.pending} highlight={stats.pending > 0} />
          <StatCard label="Inactive" value={stats.inactive} />
          <StatCard label="All-time" value={stats.totalEverCreated} />
          <StatCard label="Expiring in 2h" value={stats.expiringNext2h} />
        </div>
      )}

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <span className="mb-1 block text-xs text-text-muted">Status</span>
            <select
              multiple
              className="input h-24"
              aria-label="Status filter"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(Array.from(e.target.selectedOptions, (o) => o.value))
              }
            >
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs text-text-muted">Type</span>
            <select
              multiple
              className="input h-24"
              aria-label="Type filter"
              value={filterType}
              onChange={(e) => setFilterType(Array.from(e.target.selectedOptions, (o) => o.value))}
            >
              <option value="birthday">birthday</option>
              <option value="expression">expression</option>
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs text-text-muted">Activate at (from)</span>
            <input
              type="datetime-local"
              className="input"
              aria-label="Activate at from"
              value={activateFrom}
              onChange={(e) => setActivateFrom(e.target.value)}
            />
            <span className="mb-1 mt-2 block text-xs text-text-muted">Activate at (to)</span>
            <input
              type="datetime-local"
              className="input"
              aria-label="Activate at to"
              value={activateTo}
              onChange={(e) => setActivateTo(e.target.value)}
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-text-muted">Search</span>
            <input
              className="input"
              aria-label="Search"
              placeholder="Recipient, creator, or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="mb-1 mt-2 block text-xs text-text-muted">Sort</span>
            <div className="flex gap-2">
              <select
                className="input"
                aria-label="Sort by"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option>created_at</option>
                <option>activate_at</option>
                <option>expires_at</option>
                <option>approved_at</option>
                <option>view_count</option>
              </select>
              <select
                className="input w-24"
                aria-label="Sort order"
                value={order}
                onChange={(e) => setOrder(e.target.value as 'asc' | 'desc')}
              >
                <option>desc</option>
                <option>asc</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {err && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}

      <section className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase text-text-muted">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Recipient</th>
              <th className="px-3 py-2">Creator</th>
              <th className="px-3 py-2">Rel.</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Activate</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Approved</th>
              <th className="px-3 py-2">Views</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleRows.map((row) => (
              <tr key={row.id} className="hover:bg-white/5">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{row.short_code}</td>
                <td className="px-3 py-2">{row.type === 'birthday' ? '🎂' : '💌'}</td>
                <td className="px-3 py-2">{row.recipient_name}</td>
                <td className="px-3 py-2">{row.creator_name}</td>
                <td className="px-3 py-2 text-xs text-text-muted">{row.relationship}</td>
                <td className="px-3 py-2">
                  <StatusPill status={row.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{fmt(row.activate_at)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{fmt(row.expires_at)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{row.approved_at ? fmt(row.approved_at) : '—'}</td>
                <td className="px-3 py-2 text-center">{row.view_count}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <ActionButton onClick={() => copyLink(row.short_code)}>Copy link</ActionButton>
                    {row.status === 'pending' && (
                      <>
                        <ActionButton onClick={() => approve(row.id)} variant="primary">
                          Approve
                        </ActionButton>
                        <ActionButton onClick={() => reject(row.id)} variant="warn">
                          Reject
                        </ActionButton>
                      </>
                    )}
                    {row.status !== 'pending' && (
                      <ActionButton onClick={() => toggle(row)}>
                        {row.status === 'active' ? 'Deactivate' : 'Activate'}
                      </ActionButton>
                    )}
                    <ActionButton onClick={() => extend(row)}>Extend</ActionButton>
                    <ActionButton onClick={() => resetPasscode(row.id)}>Reset PC</ActionButton>
                    {row.expression_reply && !row.expression_reply_downloaded && (
                      <ActionButton onClick={() => markDownloaded(row.id)}>Reply ✓</ActionButton>
                    )}
                    <ActionButton onClick={() => permDelete(row)} variant="danger">
                      Delete
                    </ActionButton>
                  </div>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-sm text-text-muted">
                  No celebrations match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? 'border-accent-1 bg-accent-1/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Row['status'] }) {
  const map = {
    pending: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-200',
    active: 'border-green-400/40 bg-green-400/10 text-green-200',
    inactive: 'border-gray-400/30 bg-white/5 text-text-muted',
  } as const;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${map[status]}`}>
      {status}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'warn' | 'danger';
}) {
  const cls = {
    default: 'border-white/15 hover:bg-white/10',
    primary: 'border-green-400/40 bg-green-400/10 text-green-200 hover:bg-green-400/20',
    warn: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/20',
    danger: 'border-red-400/40 bg-red-400/10 text-red-200 hover:bg-red-400/20',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs ${cls}`}
    >
      {children}
    </button>
  );
}

function copyLink(shortCode: string): void {
  const url = `${window.location.origin}/c/${shortCode}`;
  void navigator.clipboard.writeText(url).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : '';
}

async function mutate(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<any> {
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
  }
  return data;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}
