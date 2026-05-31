import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import CountdownTimer from '../components/CountdownTimer';

const STAGE_LABELS = {
  GROUP: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarter-Finals',
  SEMI_FINAL: 'Semi-Finals',
  THIRD_PLACE: 'Third-Place Play-off',
  FINAL: 'Final',
};

const STAGE_ORDER = ['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];

const STAGE_MATCH_COUNTS = {
  GROUP: 72,
  ROUND_OF_32: 16,
  ROUND_OF_16: 8,
  QUARTER_FINAL: 4,
  SEMI_FINAL: 2,
  THIRD_PLACE: 1,
  FINAL: 1,
};

const KNOCKOUT_STAGES = new Set(['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']);

function pointsBadge(points) {
  if (points === null || points === undefined) return null;
  const colors = {
    0: 'bg-slate-700 text-slate-300',
    1: 'bg-amber-900/50 text-amber-400',
    2: 'bg-blue-900/50 text-blue-400',
    3: 'bg-emerald-900/50 text-emerald-400',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${colors[points] ?? colors[0]}`}>
      +{points} pts
    </span>
  );
}

function StageProgressRow({ stage, predicted, total }) {
  const complete = predicted === total;
  const none = predicted === 0;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5">
      <span className={`text-base leading-none ${complete ? 'text-emerald-400' : 'text-slate-600'}`}>
        {complete ? '✓' : '○'}
      </span>
      <span className={`flex-1 text-sm font-medium ${complete ? 'text-emerald-400' : 'text-slate-300'}`}>
        {STAGE_LABELS[stage]}
      </span>
      {KNOCKOUT_STAGES.has(stage) && !complete && (
        <span className="text-xs text-amber-500/80">Wait for qualifiers</span>
      )}
      <span className={`text-sm font-semibold tabular-nums ${
        complete ? 'text-emerald-400' : none ? 'text-slate-500' : 'text-amber-400'
      }`}>
        {predicted}/{total}
      </span>
    </div>
  );
}

function EditablePredictionCard({ pred }) {
  const qc = useQueryClient();
  const match = pred.matchId;
  const isKnockout = KNOCKOUT_STAGES.has(match.stage);

  const [home, setHome] = useState(pred.predictedHomeScore);
  const [away, setAway] = useState(pred.predictedAwayScore);
  const [penaltyWinner, setPenaltyWinner] = useState(pred.predictedPenaltyWinner ?? null);

  const predictedDraw = home !== '' && away !== '' && Number(home) === Number(away);
  const needsPenaltyPick = isKnockout && predictedDraw;
  const canSubmit = home !== '' && away !== '' && (!needsPenaltyPick || penaltyWinner);

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () =>
      api.post('/predictions', {
        matchId: match._id,
        predictedHomeScore: Number(home),
        predictedAwayScore: Number(away),
        ...(needsPenaltyPick ? { predictedPenaltyWinner: penaltyWinner } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myPredictions'] }),
  });

  const kickoff = new Date(match.kickoffTime);

  return (
    <div className="rounded-xl border border-emerald-700/40 bg-slate-800 px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          {kickoff.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {match.group && <span className="ml-1 text-slate-500">· Group {match.group}</span>}
        </span>
        <CountdownTimer deadline={match.predictionDeadline} />
      </div>

      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-right text-sm font-semibold text-white">
          {match.homeTeam}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            type="number"
            min="0"
            max="20"
            value={home}
            onChange={(e) => {
              setHome(Math.max(0, parseInt(e.target.value, 10) || 0));
              if (Number(e.target.value) !== Number(away)) setPenaltyWinner(null);
            }}
            className="w-12 rounded-md border border-slate-600 bg-slate-700 px-1.5 py-1 text-center text-base font-bold text-white focus:border-emerald-500 focus:outline-none"
          />
          <span className="font-bold text-slate-500">–</span>
          <input
            type="number"
            min="0"
            max="20"
            value={away}
            onChange={(e) => {
              setAway(Math.max(0, parseInt(e.target.value, 10) || 0));
              if (Number(home) !== Number(e.target.value)) setPenaltyWinner(null);
            }}
            className="w-12 rounded-md border border-slate-600 bg-slate-700 px-1.5 py-1 text-center text-base font-bold text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <span className="flex-1 truncate text-left text-sm font-semibold text-white">
          {match.awayTeam}
        </span>
      </div>

      {needsPenaltyPick && (
        <div className="mt-2.5 rounded-lg border border-amber-800/50 bg-amber-900/20 px-3 py-2">
          <p className="mb-1.5 text-center text-xs font-medium text-amber-400">
            Scores level — who wins on penalties?
          </p>
          <div className="flex justify-center gap-2">
            {[['home', match.homeTeam], ['away', match.awayTeam]].map(([side, name]) => (
              <button
                key={side}
                type="button"
                onClick={() => setPenaltyWinner(side)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  penaltyWinner === side
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2.5 flex justify-center">
        <button
          onClick={() => mutate()}
          disabled={!canSubmit || isPending}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving…' : isSuccess ? 'Saved ✓' : 'Update'}
        </button>
      </div>
    </div>
  );
}

function ReadOnlyPredictionCard({ pred }) {
  const match = pred.matchId;
  const kickoff = new Date(match.kickoffTime);
  const penaltyLabel = (w) => (w === 'home' ? match.homeTeam : match.awayTeam);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs text-slate-400">
            {kickoff.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {match.group && <span className="ml-1">· Group {match.group}</span>}
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <span className="truncate">{match.homeTeam}</span>
            <span className="text-slate-500">vs</span>
            <span className="truncate">{match.awayTeam}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:ml-4 sm:shrink-0">
          <div className="text-center">
            <div className="mb-0.5 text-xs text-slate-500">Your pick</div>
            <div className="font-bold text-white">
              {pred.predictedHomeScore}–{pred.predictedAwayScore}
            </div>
            {pred.predictedPenaltyWinner && (
              <div className="text-xs text-amber-400">{penaltyLabel(pred.predictedPenaltyWinner)} on pens</div>
            )}
          </div>

          {match.resultEntered && (
            <div className="text-center">
              <div className="mb-0.5 text-xs text-slate-500">Result</div>
              <div className="font-bold text-slate-300">
                {match.homeScore}–{match.awayScore}
              </div>
              {match.penaltyWinner && (
                <div className="text-xs text-amber-400">{penaltyLabel(match.penaltyWinner)} on pens</div>
              )}
            </div>
          )}

          <div>
            {match.resultEntered ? (
              pointsBadge(pred.pointsAwarded)
            ) : (
              <span className="text-xs text-slate-500">Pending</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyPredictions() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['myPredictions'],
    queryFn: () => api.get('/predictions/mine').then((r) => r.data),
    staleTime: 30_000,
  });

  const now = new Date();

  const totalPoints = data?.predictions.reduce((acc, p) => acc + (p.pointsAwarded ?? 0), 0) ?? 0;
  const scored = data?.predictions.filter((p) => p.pointsAwarded !== null) ?? [];

  // Group and sort predictions by stage then kickoff time
  const byStage = {};
  for (const pred of data?.predictions ?? []) {
    const stage = pred.matchId?.stage;
    if (!stage) continue;
    if (!byStage[stage]) byStage[stage] = [];
    byStage[stage].push(pred);
  }
  for (const stage of Object.keys(byStage)) {
    byStage[stage].sort(
      (a, b) => new Date(a.matchId.kickoffTime) - new Date(b.matchId.kickoffTime)
    );
  }

  const stageCounts = Object.fromEntries(
    STAGE_ORDER.map((s) => [s, byStage[s]?.length ?? 0])
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Predictions</h1>
        {data && (
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-400">{totalPoints}</div>
            <div className="text-xs text-slate-400">total points ({scored.length} scored)</div>
          </div>
        )}
      </div>

      {/* Stage progress summary */}
      {data && (
        <div className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Predictions Progress
          </h2>
          <div className="space-y-2">
            {STAGE_ORDER.map((stage) => (
              <StageProgressRow
                key={stage}
                stage={stage}
                predicted={stageCounts[stage]}
                total={STAGE_MATCH_COUNTS[stage]}
              />
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/40 p-4 text-red-400">Failed to load predictions</div>
      )}

      {data?.predictions.length === 0 && (
        <p className="text-center text-slate-400">
          No predictions yet — head to Fixtures to start predicting.
        </p>
      )}

      {/* Predictions grouped by stage */}
      {STAGE_ORDER.filter((s) => byStage[s]?.length > 0).map((stage) => {
        const isKnockout = KNOCKOUT_STAGES.has(stage);
        return (
          <section key={stage} className="mb-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-emerald-400">{STAGE_LABELS[stage]}</h2>
              <span className="text-sm text-slate-400 tabular-nums">
                {stageCounts[stage]}/{STAGE_MATCH_COUNTS[stage]} predicted
              </span>
            </div>

            {isKnockout && (
              <div className="mb-3 rounded-lg border border-amber-800/40 bg-amber-900/10 px-4 py-2.5 text-xs text-amber-400">
                ⚠ Knockout predictions lock before this stage begins. Check which teams have qualified before submitting your picks.
              </div>
            )}

            <div className="space-y-3">
              {byStage[stage].map((pred) => {
                const deadline = new Date(pred.matchId.predictionDeadline);
                const isEditable = now < deadline && !pred.matchId.resultEntered;
                return isEditable ? (
                  <EditablePredictionCard key={pred._id} pred={pred} />
                ) : (
                  <ReadOnlyPredictionCard key={pred._id} pred={pred} />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
