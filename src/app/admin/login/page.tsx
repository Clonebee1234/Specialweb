'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error?.message ?? 'Invalid password.');
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setErr('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-a text-text-primary">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl"
      >
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-text-muted">Enter the admin password to continue.</p>
        <input
          type="password"
          className="input mt-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-accent-1 px-4 py-2 font-medium text-black hover:bg-accent-1/90 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      </form>
    </main>
  );
}
