import Match from '../models/Match.js';
import Prediction from '../models/Prediction.js';
import { KNOCKOUT_STAGES } from '../config/constants.js';

function overallWinner(homeScore, awayScore, stage, penaltyWinner) {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  // Scores level — in all knockout rounds penalties decide; in group stage it's a draw
  if (KNOCKOUT_STAGES.has(stage) && penaltyWinner) return penaltyWinner;
  return 'draw';
}

export async function scoreMatch(matchId) {
  const match = await Match.findById(matchId);
  if (!match || !match.resultEntered) throw new Error('Match result not available');

  const { homeScore, awayScore, stage, penaltyWinner } = match;
  const actualTotal = homeScore + awayScore;
  const actualWinner = overallWinner(homeScore, awayScore, stage, penaltyWinner);

  const predictions = await Prediction.find({ matchId });

  const updates = predictions.map((pred) => {
    const { predictedHomeScore, predictedAwayScore, predictedPenaltyWinner } = pred;
    let points = 0;

    const scoreMatches = predictedHomeScore === homeScore && predictedAwayScore === awayScore;
    if (scoreMatches) {
      // In knockout penalty-shootout results, the draw score alone isn't enough —
      // the penalty winner is part of the "exact" outcome, so require it too.
      const needsPenWinner = KNOCKOUT_STAGES.has(stage) && penaltyWinner != null;
      if (!needsPenWinner || predictedPenaltyWinner === penaltyWinner) points++;
    }
    if (predictedHomeScore + predictedAwayScore === actualTotal) points++;

    const predictedWinner = overallWinner(
      predictedHomeScore,
      predictedAwayScore,
      stage,
      predictedPenaltyWinner
    );
    if (predictedWinner === actualWinner) points++;

    return Prediction.findByIdAndUpdate(pred._id, {
      pointsAwarded: points,
      scoredAt: new Date(),
    });
  });

  await Promise.all(updates);
}
