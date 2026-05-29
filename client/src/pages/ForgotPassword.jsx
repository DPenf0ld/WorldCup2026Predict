import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setSendingCode(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setCodeSent(true);
    } catch (err) {
      // forgot-password always returns 200, so a real error here is a network/server issue
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setCodeError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { email, code, password });
      navigate('/login', { replace: true, state: { resetSuccess: true } });
    } catch (err) {
      const msg = err.response?.data?.error || 'Reset failed. Please try again.';
      const errCode = err.response?.data?.code;
      if (errCode === 'WRONG_CODE' || errCode === 'CODE_EXPIRED' || errCode === 'TOO_MANY_ATTEMPTS') {
        setCodeError(msg);
        if (errCode === 'CODE_EXPIRED' || errCode === 'TOO_MANY_ATTEMPTS') {
          setCodeSent(false);
          setCode('');
        }
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-5xl">⚽</div>
          <h1 className="mt-3 text-3xl font-bold text-white">Kickoff</h1>
          <p className="mt-1 text-slate-400">Reset your password</p>
        </div>

        {/* ── Phase 1: enter email ── */}
        {!codeSent ? (
          <form
            onSubmit={handleSendCode}
            className="rounded-2xl border border-slate-700 bg-slate-800 p-8"
          >
            <h2 className="mb-2 text-xl font-semibold text-white">Forgot your password?</h2>
            <p className="mb-6 text-sm text-slate-400">
              Enter your email and we'll send you a 6-digit reset code.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
              placeholder="you@example.com"
            />

            <button
              type="submit"
              disabled={sendingCode}
              className="mt-5 w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {sendingCode ? 'Sending…' : 'Send reset code'}
            </button>

            <p className="mt-4 text-center text-sm text-slate-400">
              <Link to="/login" className="text-emerald-400 hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        ) : (
          /* ── Phase 2: enter code + new password ── */
          <form
            onSubmit={handleReset}
            className="rounded-2xl border border-slate-700 bg-slate-800 p-8"
          >
            <h2 className="mb-2 text-xl font-semibold text-white">Enter your reset code</h2>
            <p className="mb-6 text-sm text-slate-400">
              We sent a 6-digit code to <span className="text-white">{email}</span>.
              It expires in 10 minutes.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Reset code</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setCodeError('');
                  }}
                  className={`w-36 rounded-lg border bg-slate-700 px-4 py-2.5 text-center text-lg font-bold tracking-widest text-white focus:outline-none ${
                    codeError ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'
                  }`}
                  placeholder="000000"
                />
                {codeError && <p className="mt-1.5 text-xs text-red-400">{codeError}</p>}
              </div>

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
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              Didn't receive a code?{' '}
              <button
                type="button"
                onClick={() => { setCodeSent(false); setCode(''); setCodeError(''); }}
                className="text-emerald-400 hover:underline"
              >
                Try again
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
