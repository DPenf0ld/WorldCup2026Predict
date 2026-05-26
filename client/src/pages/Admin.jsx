import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

function adminApi(secret) {
  return axios.create({ baseURL: BASE, headers: { 'x-admin-secret': secret } });
}

const STAGE_LABELS = {
  GROUP: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarter-Finals',
  SEMI_FINAL: 'Semi-Finals',
  THIRD_PLACE: 'Third-Place Play-off',
  FINAL: 'Final',
};
const STAGE_ORDER = Object.keys(STAGE_LABELS);

// ---------------------------------------------------------------------------
// Secret gate
// ---------------------------------------------------------------------------
function SecretGate({ onAuth }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminApi(value).get('/admin/leagues');
      onAuth(value);
    } catch (err) {
      setError(err.response?.status === 403 ? 'Invalid admin secret' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl">🛡️</div>
          <h1 className="mt-3 text-2xl font-bold text-white">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-400">Kickoff · World Cup 2026</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700 bg-slate-800 p-8">
          <label className="mb-1 block text-sm font-medium text-slate-300">Admin Secret</label>
          <input
            type="password"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            placeholder="••••••••••••"
          />
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}

const KNOCKOUT_STAGES = new Set([
  'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL',
]);

// ---------------------------------------------------------------------------
// Results tab
// ---------------------------------------------------------------------------
function ResultsTab({ secret }) {
  const [matches, setMatches] = useState([]);
  const [stageFilter, setStageFilter] = useState('GROUP');
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState({});
  const [penaltyWinners, setPenaltyWinners] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi(secret).get('/admin/matches', {
        params: stageFilter ? { stage: stageFilter } : {},
      });
      setMatches(data.matches);
      const initScores = {};
      const initPens = {};
      data.matches.forEach((m) => {
        if (m.resultEntered) {
          initScores[m._id] = { home: m.homeScore, away: m.awayScore };
          initPens[m._id] = m.penaltyWinner ?? null;
        } else {
          initScores[m._id] = { home: '', away: '' };
          initPens[m._id] = null;
        }
      });
      setScores(initScores);
      setPenaltyWinners(initPens);
    } finally {
      setLoading(false);
    }
  }, [secret, stageFilter]);

  useEffect(() => { load(); }, [load]);

  const setScore = (id, field, val) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    setScores((prev) => ({ ...prev, [id]: { ...prev[id], [field]: n } }));
  };

  const submit = async (matchId, match) => {
    const { home, away } = scores[matchId] ?? {};
    if (home === '' || away === '') return;
    const isKnockout = KNOCKOUT_STAGES.has(match.stage);
    const isLevel = Number(home) === Number(away);
    if (isKnockout && isLevel && !penaltyWinners[matchId]) {
      setErrors((p) => ({ ...p, [matchId]: 'Select penalty winner' }));
      return;
    }
    setSaving((p) => ({ ...p, [matchId]: true }));
    setErrors((p) => ({ ...p, [matchId]: '' }));
    try {
      const body = { homeScore: Number(home), awayScore: Number(away) };
      if (isKnockout && isLevel) body.penaltyWinner = penaltyWinners[matchId];
      await adminApi(secret).post(`/admin/matches/${matchId}/result`, body);
      setSaved((p) => ({ ...p, [matchId]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [matchId]: false })), 2000);
      load();
    } catch (err) {
      setErrors((p) => ({ ...p, [matchId]: err.response?.data?.error || 'Failed' }));
    } finally {
      setSaving((p) => ({ ...p, [matchId]: false }));
    }
  };

  const grouped = matches.reduce((acc, m) => {
    const stage = m.stage;
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(m);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Enter Results</h2>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {!loading && STAGE_ORDER.filter((s) => grouped[s]).map((stage) => (
        <section key={stage} className="mb-8">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {STAGE_LABELS[stage]}
          </h3>
          <div className="space-y-2">
            {grouped[stage].map((m) => {
              const sc = scores[m._id] ?? { home: '', away: '' };
              const kickoff = new Date(m.kickoffTime);
              const isKnockout = KNOCKOUT_STAGES.has(m.stage);
              const isLevel = sc.home !== '' && sc.away !== '' && Number(sc.home) === Number(sc.away);
              const needsPen = isKnockout && isLevel;
              const pw = penaltyWinners[m._id];
              return (
                <div
                  key={m._id}
                  className={`rounded-xl border px-4 py-3 ${
                    m.resultEntered
                      ? 'border-emerald-800/50 bg-emerald-900/10'
                      : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-32 shrink-0 text-xs text-slate-400">
                      {kickoff.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {m.group && <span className="ml-1 text-slate-500">· Grp {m.group}</span>}
                    </div>

                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <span className="flex-1 truncate text-right text-sm font-medium text-white">
                        {m.homeTeam}
                      </span>

                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={sc.home}
                          onChange={(e) => setScore(m._id, 'home', e.target.value)}
                          className="w-12 rounded border border-slate-600 bg-slate-700 px-1 py-1 text-center text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <span className="text-slate-500">–</span>
                        <input
                          type="number"
                          min="0"
                          value={sc.away}
                          onChange={(e) => setScore(m._id, 'away', e.target.value)}
                          className="w-12 rounded border border-slate-600 bg-slate-700 px-1 py-1 text-center text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <span className="flex-1 truncate text-left text-sm font-medium text-white">
                        {m.awayTeam}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {errors[m._id] && (
                        <span className="text-xs text-red-400">{errors[m._id]}</span>
                      )}
                      {m.resultEntered && !saved[m._id] && (
                        <span className="text-xs text-emerald-500">✓ Entered</span>
                      )}
                      <button
                        onClick={() => submit(m._id, m)}
                        disabled={saving[m._id] || sc.home === '' || sc.away === ''}
                        className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {saving[m._id] ? '…' : saved[m._id] ? 'Saved ✓' : m.resultEntered ? 'Update' : 'Set Result'}
                      </button>
                    </div>
                  </div>

                  {/* Penalty winner picker — only shown for knockout matches with level scores */}
                  {needsPen && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-900/20 px-3 py-2">
                      <span className="text-xs text-amber-400 shrink-0">Penalty winner:</span>
                      {[['home', m.homeTeam], ['away', m.awayTeam]].map(([side, name]) => (
                        <button
                          key={side}
                          onClick={() => setPenaltyWinners((p) => ({ ...p, [m._id]: side }))}
                          className={`rounded px-2 py-0.5 text-xs font-semibold transition ${
                            pw === side
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                      {m.penaltyWinner && (
                        <span className="ml-auto text-xs text-slate-500">
                          Previously: {m.penaltyWinner === 'home' ? m.homeTeam : m.awayTeam}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leagues tab
// ---------------------------------------------------------------------------
function LeaguesTab({ secret }) {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadLeagues = useCallback(async () => {
    const { data } = await adminApi(secret).get('/admin/leagues');
    setLeagues(data.leagues);
  }, [secret]);

  useEffect(() => {
    loadLeagues().finally(() => setLoading(false));
  }, [loadLeagues]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await adminApi(secret).post('/admin/leagues', { name: newName });
      setNewName('');
      await loadLeagues();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create league');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Create League</h2>
        <form onSubmit={handleCreate} className="flex gap-3 rounded-xl border border-slate-700 bg-slate-800 p-5">
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="League name…"
            className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
        {createError && <p className="mt-2 text-sm text-red-400">{createError}</p>}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">All Leagues</h2>
        {leagues.length === 0 && <p className="text-slate-400">No leagues yet.</p>}
      <div className="space-y-4">
        {leagues.map((league) => (
          <div key={league.id} className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">{league.name}</h3>
              <span className="rounded-full bg-slate-700 px-3 py-0.5 text-sm text-slate-300">
                {league.memberCount} member{league.memberCount !== 1 ? 's' : ''}
              </span>
            </div>
            {league.referralCodes?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Referral Codes
                </p>
                <div className="space-y-1">
                  {league.referralCodes.map((rc) => (
                    <div
                      key={rc._id}
                      className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2 text-sm"
                    >
                      <span className="font-mono font-semibold tracking-widest text-emerald-400">
                        {rc.code}
                      </span>
                      <span className="text-slate-400">
                        {rc.usedCount} / {rc.maxUses} uses
                      </span>
                      <div className="h-1.5 w-24 rounded-full bg-slate-600">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, (rc.usedCount / rc.maxUses) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Referral codes tab
// ---------------------------------------------------------------------------

function CodesTab({ secret }) {
  const [leagues, setLeagues] = useState([]);
  const [form, setForm] = useState({ code: '', leagueId: '', maxUses: 100 });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminApi(secret)
      .get('/admin/leagues')
      .then(({ data }) => {
        setLeagues(data.leagues);
        if (data.leagues[0]) setForm((f) => ({ ...f, leagueId: data.leagues[0].id }));
      });
  }, [secret]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setLoading(true);
    try {
      await adminApi(secret).post('/admin/referral-codes', {
        code: form.code.toUpperCase(),
        leagueId: form.leagueId,
        maxUses: Number(form.maxUses),
      });
      setStatus(`Code ${form.code.toUpperCase()} created!`);
      setForm((f) => ({ ...f, code: '' }));
      // refresh league list
      const { data } = await adminApi(secret).get('/admin/leagues');
      setLeagues(data.leagues);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Create Referral Code</h2>
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-700 bg-slate-800 p-5"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Code</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="MYCODE2026"
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 font-mono uppercase tracking-widest text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">League</label>
              <select
                value={form.leagueId}
                onChange={(e) => setForm({ ...form, leagueId: e.target.value })}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              >
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Max Uses</label>
              <input
                type="number"
                min="1"
                required
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {status && <p className="mt-3 text-sm text-emerald-400">{status}</p>}

          <button
            type="submit"
            disabled={loading || !form.leagueId}
            className="mt-4 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Create Code'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">All Codes</h2>
        {leagues.flatMap((l) => l.referralCodes ?? []).length === 0 && (
          <p className="text-slate-400">No codes yet.</p>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">League</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3 text-right">Max</th>
                <th className="px-4 py-3 text-right">Usage</th>
              </tr>
            </thead>
            <tbody>
              {leagues.flatMap((l) =>
                (l.referralCodes ?? []).map((rc) => (
                  <tr key={rc._id} className="border-b border-slate-700/50">
                    <td className="px-4 py-3 font-mono font-semibold tracking-widest text-emerald-400">
                      {rc.code}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{l.name}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{rc.usedCount}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{rc.maxUses}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          rc.usedCount >= rc.maxUses ? 'text-red-400' : 'text-slate-300'
                        }`}
                      >
                        {Math.round((rc.usedCount / rc.maxUses) * 100)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin page
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'results', label: '⚽ Results' },
  { id: 'leagues', label: '🏆 Leagues' },
  { id: 'codes', label: '🔑 Referral Codes' },
];

export default function Admin() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('adminSecret') ?? '');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState('results');

  const handleAuth = (s) => {
    sessionStorage.setItem('adminSecret', s);
    setSecret(s);
    setAuthed(true);
  };

  if (!authed) return <SecretGate onAuth={handleAuth} />;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-700 bg-slate-900/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white">⚙️ Admin</span>
            <span className="rounded bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-400">
              Kickoff 2026
            </span>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('adminSecret'); setAuthed(false); }}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-700 bg-slate-800 p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'results' && <ResultsTab secret={secret} />}
        {tab === 'leagues' && <LeaguesTab secret={secret} />}
        {tab === 'codes' && <CodesTab secret={secret} />}
      </div>
    </div>
  );
}
