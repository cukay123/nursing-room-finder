'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader, Lock } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Login failed');
      }

      // Always land on /admin rather than following a redirect target from the
      // query string, which would be an open redirect.
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={20} className="text-gray-700" />
          <h1 className="text-xl font-bold text-gray-900">Admin access</h1>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Enter the admin password to review nursing room submissions.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full border rounded-lg px-3 py-2 text-black mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && (
            <p role="alert" className="text-sm text-red-600 mb-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader size={16} className="animate-spin" />}
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
