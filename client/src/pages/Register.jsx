import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', referralCode: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSendCode = async () => {
    setError('');
    if (!form.email) {
      setError('Please enter your email address first.');
      return;
    }
    setSendingCode(true);
    try {
      await api.post('/auth/send-verification-code', { email: form.email, firstName: form.firstName });
      setCodeSent(true);
      setCodeError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send code. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCodeError('');
    setSubmitting(true);
    try {
      await register(form.firstName, form.lastName, form.email, form.password, form.referralCode, verificationCode);
      navigate('/fixtures', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      const code = err.response?.data?.code;
      if (code === 'CODE_EXPIRED' || code === 'TOO_MANY_ATTEMPTS' || code === 'WRONG_CODE') {
        setCodeError(msg);
        if (code === 'CODE_EXPIRED' || code === 'TOO_MANY_ATTEMPTS') {
          setCodeSent(false);
          setVerificationCode('');
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
          <p className="mt-1 text-slate-400">Create your account to start predicting</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:p-8 shadow-xl"
        >
          <h2 className="mb-6 text-xl font-semibold text-white">Create account</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* First / Last name */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">First name</label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={set('firstName')}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Last name</label>
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={set('lastName')}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Email + send code button */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                  disabled={codeSent}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none disabled:opacity-60 sm:flex-1"
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode || codeSent}
                  className="w-full rounded-lg border border-emerald-600 px-3 py-2.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50 sm:w-auto sm:shrink-0"
                >
                  {sendingCode ? 'Sending…' : codeSent ? 'Sent ✓' : 'Send code'}
                </button>
              </div>
            </div>

            {/* Verification code — revealed after sending */}
            {codeSent && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Verification code
                  <span className="ml-2 text-xs text-slate-500">
                    (check your inbox)
                  </span>
                </label>
                <div className="flex gap-2 items-start">
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => {
                      setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setCodeError('');
                    }}
                    className={`w-36 rounded-lg border bg-slate-700 px-4 py-2.5 text-center text-lg font-bold tracking-widest text-white focus:outline-none ${
                      codeError ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'
                    }`}
                    placeholder="000000"
                  />
                  <button
                    type="button"
                    onClick={() => { setCodeSent(false); setVerificationCode(''); setCodeError(''); }}
                    className="text-xs text-slate-500 hover:text-slate-300 pt-3"
                  >
                    Resend
                  </button>
                </div>
                {codeError && (
                  <p className="mt-1.5 text-xs text-red-400">{codeError}</p>
                )}
              </div>
            )}

            {/* Password */}
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

            {/* Referral code */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Referral Code</label>
              <input
                type="text"
                required
                value={form.referralCode}
                onChange={set('referralCode')}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 font-mono uppercase tracking-widest text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="REFERRAL"
              />
              <p className="mt-1 text-xs text-slate-500">Ask your league admin for a code</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !codeSent}
            className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
          {!codeSent && (
            <p className="mt-2 text-center text-xs text-slate-500">
              You must verify your email before creating an account.
            </p>
          )}

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
