import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const MEDAL = ['🥇', '🥈', '🥉'];
const TOURNAMENT_START = 'June 11, 2026';

function fmt(amount) {
  return `£${amount.toFixed(2)}`;
}

function computePot(entryFee, paidCount) {
  const total = entryFee * paidCount;
  const dev = Math.round(total * 0.05 * 100) / 100;
  const prize = Math.round((total - dev) * 100) / 100;
  return {
    total,
    dev,
    first: Math.round(prize * 0.60 * 100) / 100,
    second: Math.round(prize * 0.25 * 100) / 100,
    third: Math.round(prize * 0.15 * 100) / 100,
  };
}

function PaymentWarningBanner({ entryFee }) {
  return (
    <div className="mb-4 rounded-xl border border-amber-700/60 bg-amber-950/30 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">⚠️</span>
        <div>
          <p className="font-semibold text-amber-300 text-sm">Payment Required</p>
          <p className="mt-1 text-sm text-amber-200/80 leading-relaxed">
            You must pay your entry fee of{' '}
            <span className="font-semibold text-white">£{entryFee}</span> before{' '}
            <span className="font-semibold text-white">{TOURNAMENT_START}</span> for your
            predictions and points to count.
          </p>
          <p className="mt-1 text-sm text-amber-200/70">
            Your entry will not appear on the leaderboard until the league organiser marks you as
            paid.
          </p>
        </div>
      </div>
    </div>
  );
}

function PayPalQRCard({ entryFee }) {
  return (
    <div className="mt-6 rounded-xl border border-blue-800/50 bg-blue-950/20 p-5">
      <h2 className="mb-4 text-base font-semibold text-blue-300">Pay Your Entry Fee</h2>
      <p className="mb-5 text-3xl font-bold text-white text-center">£{entryFee}</p>

      {/* PayPal section */}
      <div className="mb-5 flex flex-col items-center text-center">
        <p className="mb-3 text-sm font-semibold text-blue-300 uppercase tracking-wider">Option 1 — PayPal</p>
        <div className="rounded-xl bg-white p-3">
          <img
            src="/paypal-qr.png"
            alt="PayPal QR code"
            className="h-48 w-48 object-contain"
          />
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Scan the QR code, or pay via:{" "}
          <a
            href="https://paypal.me/dmpenfold"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-400 underline hover:text-blue-300"
          >
            paypal.me/dmpenfold
          </a>
        </p>
        <p className="mt-1 text-xs text-amber-400 font-medium">
          Send as <span className="underline">Friends &amp; Family</span> to avoid fees
        </p>
        <p className="mt-2 max-w-xs text-xs text-slate-400 leading-relaxed">
          Include your <span className="text-white font-medium">full name and league name</span> in the payment reference
        </p>
      </div>

      {/* Divider */}
      <div className="relative my-5 flex items-center">
        <div className="flex-grow border-t border-slate-700" />
        <span className="mx-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">OR</span>
        <div className="flex-grow border-t border-slate-700" />
      </div>

      {/* Bank transfer section */}
      <div className="flex flex-col items-center text-center">
        <p className="mb-3 text-sm font-semibold text-blue-300 uppercase tracking-wider">Option 2 — Bank Transfer</p>
        <div className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-5 py-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Name</span>
            <span className="font-semibold text-white">David Penfold</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Sort Code</span>
            <span className="font-semibold text-white font-mono">30-98-29</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Account No.</span>
            <span className="font-semibold text-white font-mono">64311868</span>
          </div>
        </div>
        <p className="mt-3 max-w-xs text-xs text-slate-400 leading-relaxed">
          Include your <span className="text-white font-medium">full name and league name</span> in the payment reference
        </p>
      </div>

      <p className="mt-5 text-center text-xs text-slate-500">
        Once payment is received the league organiser will confirm your entry
      </p>
    </div>
  );
}

function MemberList({ members, currentUserId }) {
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        All Members
      </h2>
      <div className="rounded-xl border border-slate-700 overflow-hidden">
        {members.map((member) => {
          const isMe = member.userId.toString() === currentUserId;
          return (
            <div
              key={member.userId}
              className="flex items-center justify-between border-b last:border-b-0 border-slate-700/50 px-4 py-2.5"
            >
              <span className={`text-sm font-medium ${isMe ? 'text-emerald-400' : 'text-white'}`}>
                {member.name}
                {isMe && (
                  <span className="ml-2 rounded bg-emerald-900/50 px-1.5 py-0.5 text-xs text-emerald-400">
                    you
                  </span>
                )}
              </span>
              {!member.paid && (
                <span className="rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                  Pending Payment
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrizePot({ entryFee, paidMemberCount, totalMemberCount }) {
  if (!entryFee) return null;
  const pot = computePot(entryFee, paidMemberCount);

  return (
    <div className="mt-6 rounded-xl border border-amber-800/50 bg-amber-950/20 p-5">
      <h2 className="mb-4 text-base font-semibold text-amber-300">Prize Pot</h2>

      <div className="mb-4 grid grid-cols-2 gap-y-2 text-sm">
        <span className="text-slate-400">Entry fee</span>
        <span className="text-right font-medium text-white">£{entryFee} per person</span>
        <span className="text-slate-400">Paid members</span>
        <span className="text-right font-medium text-white">
          {paidMemberCount} of {totalMemberCount}
        </span>
        <span className="font-medium text-slate-300">Total pot</span>
        <span className="text-right font-bold text-amber-300">{fmt(pot.total)}</span>
      </div>

      <div className="space-y-2 border-t border-slate-700 pt-3">
        {[
          ['🥇', '1st place', pot.first, '60%'],
          ['🥈', '2nd place', pot.second, '25%'],
          ['🥉', '3rd place', pot.third, '15%'],
        ].map(([medal, label, amount, pct]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-slate-300">
              {medal} {label}{' '}
              <span className="text-xs text-slate-500">({pct})</span>
            </span>
            <span className="font-bold text-white">{fmt(amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-slate-700/50 pt-2 text-xs text-slate-500">
          <span>5% development contribution</span>
          <span>{fmt(pot.dev)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-800/80 px-3 py-2.5 text-xs leading-relaxed text-slate-400">
        Entry fees are collected directly by the league organiser — this app does not process payments.
      </div>
    </div>
  );
}

function JoinLeague({ onJoined }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [joinedFee, setJoinedFee] = useState(null); // non-null after joining a paid league

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setJoinedFee(null);
    setLoading(true);
    try {
      const { data } = await api.post('/leagues/join', { referralCode: code });
      setCode('');
      onJoined(data.user);
      const fee = data.league?.entryFee ?? 0;
      if (fee > 0) {
        setSuccess(data.message);
        setJoinedFee(fee);
      } else {
        setSuccess(data.message);
        setTimeout(() => { setSuccess(''); setOpen(false); }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join league');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50">
      <button
        onClick={() => { setOpen((o) => !o); setError(''); setSuccess(''); setJoinedFee(null); }}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:text-white"
      >
        <span>＋ Join another league</span>
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-700 px-4 pb-4 pt-3">
          {joinedFee ? (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-4">
              <p className="mb-1 text-sm font-semibold text-amber-300">✓ {success}</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                This league has an entry fee of{' '}
                <span className="font-semibold text-white">£{joinedFee}</span>. Please send
                your entry fee directly to the league organiser via bank transfer or PayPal.
                Your entry is not confirmed until the organiser marks you as paid.
              </p>
              <button
                onClick={() => { setJoinedFee(null); setSuccess(''); setOpen(false); }}
                className="mt-3 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
              >
                Got it
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
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
              {success && !joinedFee && <p className="mt-2 text-sm text-emerald-400">✓ {success}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function Leaderboard() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
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
          {data.league.entryFee > 0 && !data.currentUserPaid && (
            <PaymentWarningBanner entryFee={data.league.entryFee} />
          )}

          <p className="mb-2 text-sm text-slate-400">
            {data.league.name} ·{' '}
            {data.league.entryFee > 0
              ? `${data.league.paidMemberCount} paid of ${data.league.totalMemberCount} member${data.league.totalMemberCount !== 1 ? 's' : ''}`
              : `${data.leaderboard.length} member${data.leaderboard.length !== 1 ? 's' : ''}`}
          </p>
          <p className="mb-4 text-xs text-slate-500">Tap a player's name to see their picks</p>

          {data.leaderboard.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-8 text-center text-sm text-slate-400">
              No paid members on the leaderboard yet.
            </div>
          ) : (
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
                    const isMe = entry.userId.toString() === user?.id;
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
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/leaderboard/user/${entry.userId}`)}
                            className="group flex items-center gap-1.5 text-left font-medium text-emerald-400 underline underline-offset-2 decoration-emerald-400/40 hover:decoration-emerald-400 transition"
                          >
                            {entry.name}
                            {isMe && (
                              <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-xs text-emerald-400 no-underline">
                                you
                              </span>
                            )}
                            <span className="text-slate-500 group-hover:text-slate-300 transition text-xs">→</span>
                          </button>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-right text-slate-300">{entry.predictionsScored}</td>
                        <td className="px-4 py-3 text-right font-bold text-white">{entry.totalPoints}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <PrizePot
            entryFee={data.league.entryFee}
            paidMemberCount={data.league.paidMemberCount}
            totalMemberCount={data.league.totalMemberCount}
          />

          {data.league.entryFee > 0 && data.allMembers?.length > 0 && (
            <MemberList members={data.allMembers} currentUserId={user?.id} />
          )}

          {user && data.league.entryFee > 0 && !data.currentUserPaid && (
            <PayPalQRCard entryFee={data.league.entryFee} />
          )}
        </>
      )}

      <JoinLeague onJoined={handleJoined} />
    </div>
  );
}
