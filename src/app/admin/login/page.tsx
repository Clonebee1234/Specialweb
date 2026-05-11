'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!password.trim()) {
      setErr('Please enter a password');
      return;
    }

    setErr(null);
    setBusy(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        
        if (res.status === 429) {
          setErr('Too many login attempts. Please wait a few minutes and try again.');
        } else if (res.status === 401) {
          setErr('Invalid password. Please try again.');
        } else if (res.status === 500) {
          setErr('Server error. Please check that all environment variables are configured correctly.');
        } else {
          setErr(data?.error?.message ?? 'Login failed. Please try again.');
        }
        setBusy(false);
        return;
      }

      const data = await res.json();
      
      if (data.ok) {
        // Force a hard navigation to ensure cookies are sent
        window.location.href = '/admin';
      } else {
        setErr('Login failed. Please try again.');
        setBusy(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setErr('Network error. Please check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-a text-text-primary">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl"
      >
        <h1 className="text-2xl font-semibold">Admin Login</h1>
        <p className="mt-1 text-sm text-text-muted">Enter the admin password to continue.</p>
        
        <input
          type="password"
          className="input mt-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          disabled={busy}
        />
        
        <button
          type="submit"
          disabled={busy || !password.trim()}
          className="mt-4 w-full rounded-lg bg-accent-1 px-4 py-2 font-medium text-black hover:bg-accent-1/90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        
        {err && (
          <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}
      </form>
    </main>
  );
}
