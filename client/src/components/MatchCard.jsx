import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import CountdownTimer from './CountdownTimer';

const KNOCKOUT_STAGES = new Set([
  'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL',
]);

function ScoreInput({ value, onChange, disabled }) {
  return (
    <input
      type="number"
      min="0"
      max="20"
      value={value}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
      disabled={disabled}
      className="w-14 rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-center text-lg font-bold text-white focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function PenaltyPicker({ homeTeam, awayTeam, value, onChange, disabled }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-900/20 px-4 py-2.5">
      <p className="mb-2 text-center text-xs font-medium text-amber-400">
        Scores level — who wins on penalties?
      </p>
      <div className="flex justify-center gap-2">
        {[['home', homeTeam], ['away', awayTeam]].map(([side, name]) => (
          <button
            key={side}
            type="button"
            disabled={disabled}
            onClick={() => onChange(side)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              value === side
                ? 'bg-amber-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MatchCard({ match }) {
  const qc = useQueryClient();
  const [home, setHome] = useState(match.userPrediction?.predictedHomeScore ?? '');
  const [away, setAway] = useState(match.userPrediction?.predictedAwayScore ?? '');
  const [penaltyWinner, setPenaltyWinner] = useState(
    match.userPrediction?.predictedPenaltyWinner ?? null
  );

  const isPast = match.deadlinePassed;
  const hasResult = match.resultEntered;
  const isKnockout = KNOCKOUT_STAGES.has(match.stage);
  const predictedDraw = home !== '' && away !== '' && Number(home) === Number(away);
  const needsPenaltyPick = isKnockout && predictedDraw;

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () =>
      api.post('/predictions', {
        matchId: match._id,
        predictedHomeScore: Number(home),
        predictedAwayScore: Number(away),
        ...(needsPenaltyPick ? { predictedPenaltyWinner: penaltyWinner } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  });

  const kickoff = new Date(match.kickoffTime);
  const dateStr = kickoff.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const canSubmit = !isPast && home !== '' && away !== '' && (!needsPenaltyPick || penaltyWinner);

  // Penalty winner label for results display
  const penaltyLabel = (winner) => winner === 'home' ? match.homeTeam : match.awayTeam;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 transition hover:border-slate-600">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-y-1 text-xs text-slate-400">
        <span>{dateStr} · {timeStr}</span>
        <div className="flex items-center gap-2">
          {match.group && <span className="rounded bg-slate-700 px-1.5 py-0.5">Group {match.group}</span>}
          {isKnockout && !match.group && (
            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-400">No draws</span>
          )}
          {!isPast && !hasResult && (
            <CountdownTimer deadline={match.predictionDeadline} />
          )}
          {isPast && !hasResult && (
            <span className="rounded bg-red-900/40 px-2 py-0.5 text-red-400">Locked</span>
          )}
          {hasResult && (
            <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-emerald-400">Result in</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <span className="flex-1 text-right text-sm font-semibold">{match.homeTeam}</span>

        <div className="flex items-center gap-2">
          {hasResult ? (
            <div className="flex items-center gap-1 text-xl font-bold">
              <span>{match.homeScore}</span>
              <span className="text-slate-500">–</span>
              <span>{match.awayScore}</span>
            </div>
          ) : (
            <>
              <ScoreInput value={home} onChange={(v) => { setHome(v); if (!predictedDraw) setPenaltyWinner(null); }} disabled={isPast} />
              <span className="text-slate-500">–</span>
              <ScoreInput value={away} onChange={(v) => { setAway(v); if (!predictedDraw) setPenaltyWinner(null); }} disabled={isPast} />
            </>
          )}
        </div>

        <span className="flex-1 text-left text-sm font-semibold">{match.awayTeam}</span>
      </div>

      {/* Penalty winner info on result */}
      {hasResult && match.penaltyWinner && (
        <p className="mt-2 text-center text-xs text-amber-400">
          {penaltyLabel(match.penaltyWinner)} win on penalties
        </p>
      )}

      {/* Penalty picker for predictions */}
      {!isPast && !hasResult && needsPenaltyPick && (
        <PenaltyPicker
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          value={penaltyWinner}
          onChange={setPenaltyWinner}
          disabled={isPast}
        />
      )}

      {!isPast && !hasResult && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => mutate()}
            disabled={!canSubmit || isPending}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Saving…' : isSuccess ? 'Saved ✓' : match.userPrediction ? 'Update' : 'Predict'}
          </button>
        </div>
      )}

      {match.userPrediction && hasResult && (
        <div className="mt-2 text-center text-sm">
          <span className="text-slate-400">
            Your prediction:{' '}
            <span className="font-semibold text-white">
              {match.userPrediction.predictedHomeScore}–{match.userPrediction.predictedAwayScore}
              {match.userPrediction.predictedPenaltyWinner && (
                <span className="ml-1 text-amber-400">
                  ({penaltyLabel(match.userPrediction.predictedPenaltyWinner)} on pens)
                </span>
              )}
            </span>
          </span>
          {match.userPrediction.pointsAwarded !== null && (
            <span className="ml-2 rounded bg-emerald-900/50 px-2 py-0.5 text-emerald-400">
              +{match.userPrediction.pointsAwarded} pts
            </span>
          )}
        </div>
      )}
    </div>
  );
}
