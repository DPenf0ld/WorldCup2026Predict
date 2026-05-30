import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

const STAGE_LABELS = {
  GROUP: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarter-Finals',
  SEMI_FINAL: 'Semi-Finals',
  THIRD_PLACE: 'Third-Place Play-off',
  FINAL: 'Final',
};

const POINTS_COLORS = {
  0: 'bg-slate-700 text-slate-300',
  1: 'bg-amber-900/50 text-amber-400',
  2: 'bg-blue-900/50 text-blue-400',
  3: 'bg-emerald-900/50 text-emerald-400',
};

function pointsBadge(points) {
  if (points === null || points === undefined) return null;
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${POINTS_COLORS[points] ?? POINTS_COLORS[0]}`}>
      +{points} pts
    </span>
  );
}

export default function UserPredictions() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['userPredictions', userId],
    queryFn: () => api.get(`/predictions/user/${userId}`).then((r) => r.data),
    staleTime: 60_000,
  });

  const totalPoints = data?.predictions.reduce((acc, p) => acc + (p.pointsAwarded ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition"
      >
        <span>←</span> Back to leaderboard
      </button>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/40 p-4 text-red-400">Failed to load predictions</div>
      )}

      {data && (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{data.user.name}</h1>
              <p className="mt-1 text-sm text-slate-400">
                {data.predictions.length} scored prediction{data.predictions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{totalPoints}</div>
              <div className="text-xs text-slate-400">total points</div>
            </div>
          </div>

          {data.predictions.length === 0 && (
            <p className="text-center text-slate-400">No scored predictions yet.</p>
          )}

          <div className="space-y-3">
            {data.predictions.map((pred) => {
              const match = pred.matchId;
              const kickoff = new Date(match.kickoffTime);
              const penaltyLabel = (winner) => winner === 'home' ? match.homeTeam : match.awayTeam;

              return (
                <div
                  key={pred._id}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-400 mb-1">
                        {STAGE_LABELS[match.stage]} ·{' '}
                        {kickoff.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <span className="truncate">{match.homeTeam}</span>
                        <span className="text-slate-500">vs</span>
                        <span className="truncate">{match.awayTeam}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:ml-4 sm:shrink-0">
                      <div className="text-center">
                        <div className="text-xs text-slate-500 mb-0.5">Their pick</div>
                        <div className="font-bold text-white">
                          {pred.predictedHomeScore}–{pred.predictedAwayScore}
                        </div>
                        {pred.predictedPenaltyWinner && (
                          <div className="text-xs text-amber-400">
                            {penaltyLabel(pred.predictedPenaltyWinner)} on pens
                          </div>
                        )}
                      </div>

                      <div className="text-center">
                        <div className="text-xs text-slate-500 mb-0.5">Result</div>
                        <div className="font-bold text-slate-300">
                          {match.homeScore}–{match.awayScore}
                        </div>
                        {match.penaltyWinner && (
                          <div className="text-xs text-amber-400">
                            {penaltyLabel(match.penaltyWinner)} on pens
                          </div>
                        )}
                      </div>

                      <div>{pointsBadge(pred.pointsAwarded)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
