import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const MEDAL = ['🥇', '🥈', '🥉'];

function JoinLeague({ onJoined }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await api.post('/leagues/join', { referralCode: code });
      setSuccess(data.message);
      setCode('');
      onJoined(data.user);
      setTimeout(() => { setSuccess(''); setOpen(false); }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join league');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50">
      <button
        onClick={() => { setOpen((o) => !o); setError(''); setSuccess(''); }}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:text-white"
      >
        <span>＋ Join another league</span>
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-slate-700 px-4 pb-4 pt-3">
          <p className="mb-3 text-xs text-slate-400">
            Enter a referral code from a league you want to join.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="REFERRAL CODE"
              className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 font-mono uppercase tracking-widest text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? '…' : 'Join'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          {success && <p className="mt-2 text-sm text-emerald-400">✓ {success}</p>}
        </form>
      )}
    </div>
  );
}

export default function Leaderboard() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const leagues = user?.leagues ?? [];
  const [selectedLeague, setSelectedLeague] = useState(leagues[0]?._id ?? leagues[0] ?? '');

  const leagueId = selectedLeague;

  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', leagueId],
    queryFn: () => api.get('/leaderboard', { params: { leagueId } }).then((r) => r.data),
    enabled: !!leagueId,
    staleTime: 60_000,
  });

  const handleJoined = async (updatedUser) => {
    await refreshUser();
    qc.invalidateQueries({ queryKey: ['leaderboard'] });
    // Switch to the newly joined league
    const newLeague = updatedUser.leagues?.at(-1);
    if (newLeague) setSelectedLeague(newLeague._id ?? newLeague);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        {leagues.length > 1 && (
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            {leagues.map((l) => (
              <option key={l._id ?? l} value={l._id ?? l}>
                {l.name ?? l}
              </option>
            ))}
          </select>
        )}
      </div>

      {!leagueId && (
        <p className="text-slate-400">You are not a member of any league yet.</p>
      )}

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/40 p-4 text-red-400">Failed to load leaderboard</div>
      )}

      {data && (
        <>
          <p className="mb-4 text-sm text-slate-400">
            {data.league.name} · {data.leaderboard.length} members
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Player</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-right">Predictions</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((entry) => {
                  const isMe = entry.userId === user?.id;
                  return (
                    <tr
                      key={entry.userId}
                      className={`border-b border-slate-700/50 transition ${
                        isMe ? 'bg-emerald-900/20' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {MEDAL[entry.rank - 1] ?? entry.rank}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {entry.name}
                        {isMe && (
                          <span className="ml-2 rounded bg-emerald-900/50 px-1.5 py-0.5 text-xs text-emerald-400">
                            you
                          </span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right text-slate-300">{entry.predictionsScored}</td>
                      <td className="px-4 py-3 text-right font-bold text-white">{entry.totalPoints}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <JoinLeague onJoined={handleJoined} />
    </div>
  );
}
