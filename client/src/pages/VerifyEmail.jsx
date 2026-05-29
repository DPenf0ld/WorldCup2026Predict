import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [error, setError] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    // Wait for AuthContext to finish its own session-restore check first.
    // Without this, the refresh-check response could overwrite the user state
    // that verifyEmail sets, leaving the user in a logged-out state.
    if (authLoading) return;

    // Guard against StrictMode double-fire and repeated renders
    if (attempted.current) return;
    attempted.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setError('No verification token found in this link.');
      setStatus('error');
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/fixtures', { replace: true }), 2000);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Verification failed. The link may have expired.');
        setStatus('error');
      });
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl mb-4">⚽</div>
        <h1 className="text-2xl font-bold text-white mb-2">Kickoff</h1>

        {status === 'verifying' && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-8 mt-6">
            <div className="flex justify-center mb-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
            <p className="text-slate-300">Verifying your email address…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="rounded-2xl border border-emerald-800/50 bg-emerald-900/20 p-8 mt-6">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-semibold text-white mb-2">Email verified!</h2>
            <p className="text-slate-300 text-sm">Redirecting you to the app…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-8 mt-6">
            <div className="text-4xl mb-3">❌</div>
            <h2 className="text-xl font-semibold text-white mb-2">Verification failed</h2>
            <p className="text-red-400 text-sm mb-6">{error}</p>
            <div className="flex flex-col gap-3">
              <Link
                to="/login"
                className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Back to login
              </Link>
              <p className="text-xs text-slate-500">
                From the login page you can request a new verification email.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
