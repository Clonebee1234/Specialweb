'use client';

import { useEffect, useState } from 'react';

type Settings = {
  default_activation_window_hours: number;
  maintenance_mode: boolean;
  has_admin_password_hash: boolean;
};

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : '';
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaultHours, setDefaultHours] = useState(21);
  const [maintenance, setMaintenance] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data: Settings) => {
        setSettings(data);
        setDefaultHours(data.default_activation_window_hours);
        setMaintenance(data.maintenance_mode);
      });
  }, []);

  async function save() {
    setMsg(null);
    const body: Record<string, unknown> = {
      default_activation_window_hours: defaultHours,
      maintenance_mode: maintenance,
    };
    if (newPassword) {
      body.admin_password_current = currentPassword;
      body.admin_password_new = newPassword;
    }
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': getCookie('ct_csrf'),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Saved.' : data?.error?.message ?? 'Failed.');
    setNewPassword('');
    setCurrentPassword('');
  }

  if (!settings) return <main className="p-8 text-text-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-xl space-y-6 p-8 text-text-primary">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="space-y-2">
        <span className="block text-sm text-text-muted">
          Default activation window (hours) — future-facing only; existing celebrations stay at 21h.
        </span>
        <input
          type="number"
          min={1}
          max={168}
          className="input"
          aria-label="Default activation window hours"
          value={defaultHours}
          onChange={(e) => setDefaultHours(Number(e.target.value))}
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={maintenance}
          onChange={(e) => setMaintenance(e.target.checked)}
        />
        <span>Maintenance mode</span>
      </label>

      <div className="space-y-2">
        <div className="text-sm font-medium">Change admin password</div>
        <input
          type="password"
          className="input"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <input
          type="password"
          className="input"
          placeholder="New password (min 8 chars)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={save}
        className="rounded-lg bg-accent-1 px-5 py-2 font-medium text-black"
      >
        Save
      </button>
      {msg && <p className="text-sm text-text-muted">{msg}</p>}
      <a href="/admin" className="inline-block text-sm text-accent-1 underline">
        ← Back to dashboard
      </a>
    </main>
  );
}
