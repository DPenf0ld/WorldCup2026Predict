import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', referralCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.referralCode);
      navigate('/fixtures');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-5xl">⚽</div>
          <h1 className="mt-3 text-3xl font-bold text-white">Kickoff</h1>
          <p className="mt-1 text-slate-400">Create your account to start predicting</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl"
        >
          <h2 className="mb-6 text-xl font-semibold text-white">Create account</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={set('name')}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={set('email')}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={set('password')}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Referral Code</label>
              <input
                type="text"
                required
                value={form.referralCode}
                onChange={set('referralCode')}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 font-mono uppercase tracking-widest text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="KICKOFF2026"
              />
              <p className="mt-1 text-xs text-slate-500">Ask your league admin for a code</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="mt-4 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
