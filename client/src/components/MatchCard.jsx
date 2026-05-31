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
      max="99"
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') { onChange(''); return; }
        const num = parseInt(raw, 10);
        if (isNaN(num) || num < 0 || num > 99) return;
        onChange(num);
      }}
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

function LiveDot() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-semibold text-emerald-400">Live</span>
    </span>
  );
}

export default function MatchCard({ match }) {
  const qc = useQueryClient();
  const [home, setHome] = useState(match.userPrediction?.predictedHomeScore ?? '');
  const [away, setAway] = useState(match.userPrediction?.predictedAwayScore ?? '');
  const [penaltyWinner, setPenaltyWinner] = useState(
    match.userPrediction?.predictedPenaltyWinner ?? null
  );

  const isLive = match.status === 'IN_PLAY';
  const isPaused = match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED' || match.resultEntered;
  const isPostponed = match.status === 'POSTPONED' || match.status === 'SUSPENDED' || match.status === 'CANCELLED';

  const isPast = match.deadlinePassed;
  const isKnockout = KNOCKOUT_STAGES.has(match.stage);
  const predictedDraw = home !== '' && away !== '' && Number(home) === Number(away);
  const needsPenaltyPick = isKnockout && predictedDraw;

  const showInputs = !isPast && !isLive && !isPaused && !isFinished;

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

  const canSubmit = showInputs && home !== '' && away !== '' && (!needsPenaltyPick || penaltyWinner);

  const penaltyLabel = (winner) => winner === 'home' ? match.homeTeam : match.awayTeam;

  // Current/final scores for display
  const liveHome = match.fullTimeScore?.home ?? 0;
  const liveAway = match.fullTimeScore?.away ?? 0;
  const htHome = match.halfTimeScore?.home;
  const htAway = match.halfTimeScore?.away;
  const showHalfTime = (isLive || isPaused || isFinished) && htHome !== null && htHome !== undefined;

  return (
    <div className={`rounded-xl border bg-slate-800 p-4 transition hover:border-slate-600 ${
      isLive ? 'border-emerald-700/60' : 'border-slate-700'
    }`}>
      {/* Top meta row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-y-1 text-xs text-slate-400">
        <div className="flex flex-col gap-0.5">
          <span>{dateStr} · {timeStr}</span>
          {match.venue && (
            <span className="text-slate-500">{match.venue}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {match.group && <span className="rounded bg-slate-700 px-1.5 py-0.5">Group {match.group}</span>}
          {isKnockout && !match.group && (
            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-400">No draws</span>
          )}

          {isLive && <LiveDot />}
          {isPaused && (
            <span className="rounded bg-amber-900/40 px-2 py-0.5 text-amber-400">Half Time</span>
          )}
          {isFinished && (
            <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-emerald-400">Full Time</span>
          )}
          {isPostponed && (
            <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-400 capitalize">
              {match.status?.toLowerCase() ?? 'postponed'}
            </span>
          )}
          {!isPast && !isLive && !isPaused && !isFinished && !isPostponed && (
            <CountdownTimer deadline={match.predictionDeadline} />
          )}
          {isPast && !isLive && !isPaused && !isFinished && !isPostponed && (
            <span className="rounded bg-red-900/40 px-2 py-0.5 text-red-400">Locked</span>
          )}
        </div>
      </div>

      {/* Teams + score row */}
      <div className="flex items-center gap-2 sm:gap-4">
        <span className="flex-1 text-right text-sm font-semibold">{match.homeTeam}</span>

        <div className="flex items-center gap-2">
          {/* Live / paused — show current score */}
          {(isLive || isPaused) && (
            <div className={`flex items-center gap-1 text-2xl font-bold ${isLive ? 'text-emerald-400' : 'text-white'}`}>
              <span>{liveHome}</span>
              <span className="text-slate-500">–</span>
              <span>{liveAway}</span>
            </div>
          )}

          {/* Finished — show final score */}
          {isFinished && (
            <div className="flex items-center gap-1 text-xl font-bold">
              <span>{match.homeScore}</span>
              <span className="text-slate-500">–</span>
              <span>{match.awayScore}</span>
            </div>
          )}

          {/* Scheduled / open for prediction */}
          {showInputs && (
            <>
              <ScoreInput value={home} onChange={(v) => { setHome(v); if (!predictedDraw) setPenaltyWinner(null); }} disabled={false} />
              <span className="text-slate-500">–</span>
              <ScoreInput value={away} onChange={(v) => { setAway(v); if (!predictedDraw) setPenaltyWinner(null); }} disabled={false} />
            </>
          )}

          {/* Past + locked (no result yet, no live status) */}
          {isPast && !isLive && !isPaused && !isFinished && !isPostponed && (
            <div className="flex items-center gap-1 text-lg text-slate-500">
              <span>{match.userPrediction?.predictedHomeScore ?? '–'}</span>
              <span>–</span>
              <span>{match.userPrediction?.predictedAwayScore ?? '–'}</span>
            </div>
          )}
        </div>

        <span className="flex-1 text-left text-sm font-semibold">{match.awayTeam}</span>
      </div>

      {/* Half-time score line */}
      {showHalfTime && (
        <p className="mt-1.5 text-center text-xs text-slate-500">
          HT: {htHome}–{htAway}
        </p>
      )}

      {/* Penalty winner info on result */}
      {isFinished && match.penaltyWinner && (
        <p className="mt-1.5 text-center text-xs text-amber-400">
          {penaltyLabel(match.penaltyWinner)} win on penalties
        </p>
      )}

      {/* Penalty picker for predictions */}
      {showInputs && needsPenaltyPick && (
        <PenaltyPicker
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          value={penaltyWinner}
          onChange={setPenaltyWinner}
          disabled={false}
        />
      )}

      {showInputs && (
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

      {/* User prediction summary after result */}
      {match.userPrediction && isFinished && (
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
