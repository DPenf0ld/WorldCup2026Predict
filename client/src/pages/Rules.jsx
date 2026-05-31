const Section = ({ title, children }) => (
  <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
    <h2 className="mb-4 text-base font-semibold text-emerald-400">{title}</h2>
    {children}
  </div>
);

const Row = ({ label, value, highlight }) => (
  <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${highlight ? 'bg-emerald-900/20' : 'bg-slate-700/40'}`}>
    <span className="text-sm text-slate-300">{label}</span>
    <span className={`text-sm font-semibold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
  </div>
);

export default function Rules() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">How to Play</h1>
        <p className="mt-1 text-slate-400">Everything you need to know about Kickoff predictions</p>
      </div>

      <div className="space-y-5">
        {/* Overview */}
        <Section title="⚽ The Basics">
          <p className="text-sm leading-relaxed text-slate-300">
            Before each match kicks off, predict the exact score. You earn points based on how accurate your
            prediction is — even a wrong score can earn points if you got the right winner or the right
            number of goals. Compete against friends in private leagues on a shared leaderboard.
          </p>
        </Section>

        {/* Scoring */}
        <Section title="🏆 Scoring System">
          <p className="mb-3 text-sm text-slate-400">Each match is worth a maximum of 3 points:</p>
          <div className="space-y-2">
            <Row label="Correct exact score  (e.g. you predict 2–1, result is 2–1)" value="+1 pt" />
            <Row label="Correct total goals  (e.g. you predict 3–0, result is 2–1 — both total 3)" value="+1 pt" />
            <Row label="Correct outcome  (home win / draw / away win — or penalty winner in knockouts)" value="+1 pt" />
            <Row label="Maximum per match" value="3 pts" highlight />
          </div>
          <div className="mt-4 rounded-lg bg-slate-700/40 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Example</p>
            <div className="space-y-1 text-sm text-slate-300">
              <p>Result: <span className="font-semibold text-white">France 2–1 Brazil</span></p>
              <p>Your prediction: <span className="font-semibold text-white">France 3–0 Brazil</span></p>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                <li>❌ Exact score — wrong (3–0 ≠ 2–1)</li>
                <li>✅ Total goals — correct (both 3 goals)</li>
                <li>✅ Outcome — correct (France win)</li>
              </ul>
              <p className="mt-2 font-semibold text-emerald-400">Score: 2 pts</p>
            </div>
          </div>
        </Section>

        {/* Knockout scoring */}
        <Section title="🔴 Knockout Rounds — No Draws">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              From the <span className="font-semibold text-white">Round of 32</span> onwards, one team must always advance — there are no draws. If scores are level after 90 minutes, the match goes to extra time and then <span className="font-semibold text-amber-400">penalties</span> if still level.
            </p>
            <p>
              When predicting any knockout match, if you enter equal scores (e.g. 1–1) a{' '}
              <span className="font-semibold text-amber-400">penalty winner picker</span> will
              appear — you must select which team you think wins the shootout before you can submit.
            </p>
            <div className="rounded-lg bg-slate-700/40 px-4 py-3 text-xs text-slate-400 space-y-2">
              <p className="font-semibold text-slate-300">How the outcome point works in knockouts:</p>
              <p>→ Your predicted winner is whoever wins overall — either by scoring more goals, by a goal in extra time, or by winning on penalties if you predicted a draw score.</p>
              <p>→ If you predicted 2–1 (home win) and the result was 1–1 with the home team winning on penalties, you get the outcome point — both mean the home team advances.</p>
              <p>→ The exact score is always compared against the score when the game finished — including any goals scored in extra time. For example, if a match is 1–1 at 90 mins and both teams score in extra time before penalties, the target score is 2–2, not 1–1.</p>
              <p>→ If you predicted 1–1 and picked the correct penalty winner, you can score all three points — the 1–1 is the final score and your predicted winner matches the actual winner.</p>
            </div>
            <div className="rounded-lg bg-emerald-900/20 border border-emerald-800/40 px-4 py-3 text-xs space-y-1">
              <p className="font-semibold text-emerald-300">Example — any knockout round</p>
              <p className="text-slate-300">Result: <span className="font-semibold text-white">1–1 (Team A wins on penalties)</span></p>
              <p className="text-slate-300">Your prediction: <span className="font-semibold text-white">Team A 2–0</span></p>
              <ul className="mt-1 space-y-1 text-slate-400">
                <li>❌ Exact score — wrong (2–0 ≠ 1–1)</li>
                <li>✅ Total goals — correct (both 2 goals)</li>
                <li>✅ Outcome — correct (Team A advances)</li>
              </ul>
              <p className="mt-1 font-semibold text-emerald-400">Score: 2 pts</p>
            </div>
          </div>
        </Section>

        {/* Deadlines */}
        <Section title="⏱️ Prediction Deadlines">
          <p className="mb-3 text-sm text-slate-400">
            Predictions lock automatically — you cannot submit or edit after the deadline.
          </p>
          <div className="space-y-2">
            <Row label="Group Stage" value="1 hour before each match" />
            <Row label="Round of 32 onwards" value="1 hour before the stage begins" />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            A countdown timer appears on each match card when the deadline is approaching.
          </p>
        </Section>

        {/* Tournament format */}
        <Section title="🗓️ Tournament Format">
          <p className="mb-3 text-sm text-slate-400">
            The 2026 FIFA World Cup features 48 teams across 7 rounds:
          </p>
          <div className="space-y-2">
            {[
              { stage: 'Group Stage', detail: '12 groups of 4 · top 2 + 8 best 3rd place advance', matches: '72 matches' },
              { stage: 'Round of 32', detail: '32 teams remaining', matches: '16 matches' },
              { stage: 'Round of 16', detail: '16 teams remaining', matches: '8 matches' },
              { stage: 'Quarter-Finals', detail: '8 teams remaining', matches: '4 matches' },
              { stage: 'Semi-Finals', detail: '4 teams remaining', matches: '2 matches' },
              { stage: 'Third-Place Play-off', detail: 'Semi-final losers', matches: '1 match' },
              { stage: 'Final', detail: 'The big one', matches: '1 match' },
            ].map(({ stage, detail, matches }) => (
              <div key={stage} className="flex items-center justify-between rounded-lg bg-slate-700/40 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">{stage}</p>
                  <p className="text-xs text-slate-500">{detail}</p>
                </div>
                <span className="text-xs text-slate-400">{matches}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Leagues */}
        <Section title="👥 Leagues">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Leagues are private groups where you compete against friends. Your predictions are
              global — one prediction counts across every league you belong to.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="mt-0.5 text-emerald-400">→</span>
                <span>Join a league using a referral code on the Leaderboard page.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-emerald-400">→</span>
                <span>You can be a member of multiple leagues at the same time.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-emerald-400">→</span>
                <span>Switch between league leaderboards using the dropdown at the top of the Leaderboard page.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-emerald-400">→</span>
                <span>Points only count once a match result has been entered by an admin.</span>
              </li>
            </ul>
          </div>
        </Section>

        {/* Tips */}
        <Section title="💡 Tips">
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex gap-2">
              <span className="text-amber-400">★</span>
              <span>You can edit your prediction any time before the deadline — don't rush.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">★</span>
              <span>Predicting a draw and being right is worth just as much as predicting a win.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">★</span>
              <span>Total goals is often the easiest point to pick up — even 0–0 vs 1–1 can score.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">★</span>
              <span>Check the My Predictions page after results come in to track your score breakdown.</span>
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
