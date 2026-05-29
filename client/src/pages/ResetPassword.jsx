import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-md text-center rounded-2xl border border-slate-700 bg-slate-800 p-8">
          <p className="text-red-400 mb-4">Invalid reset link — no token found.</p>
          <Link to="/forgot-password" className="text-emerald-400 hover:underline text-sm">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-5xl">⚽</div>
          <h1 className="mt-3 text-3xl font-bold text-white">Kickoff</h1>
          <p className="mt-1 text-slate-400">Choose a new password</p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-800/50 bg-emerald-900/20 p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-semibold text-white mb-2">Password updated!</h2>
            <p className="text-sm text-slate-400">Redirecting you to login…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-700 bg-slate-800 p-8"
          >
            <h2 className="mb-6 text-xl font-semibold text-white">Set new password</h2>

            {error && (
              <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                  placeholder="Repeat your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>

            <p className="mt-4 text-center text-sm text-slate-400">
              <Link to="/login" className="text-emerald-400 hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
