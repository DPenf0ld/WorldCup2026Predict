export default function Support() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-white">Support Development</h1>
      <p className="mb-8 text-slate-400">
        Kickoff was built as a personal project to make World Cup 2026 more fun for friends,
        family, and colleagues. Everything — fixtures, scoring, leaderboards, and leagues — runs
        for free to use.
      </p>

      <div className="space-y-5">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-3 text-base font-semibold text-white">How we cover costs</h2>
          <p className="mb-4 text-sm text-slate-400 leading-relaxed">
            Hosting and running this app isn't free. To help cover ongoing costs, a small{' '}
            <span className="font-semibold text-emerald-400">5% development contribution</span> is
            taken from prize pots in paid leagues. This comes out of the pot before prizes are
            distributed and is clearly shown in each league's Prize Pot breakdown.
          </p>
          <p className="text-sm text-slate-500">
            No money passes through the app — entry fees are handled directly between players and
            league organisers. The 5% is an agreed contribution from the organiser's share.
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-3 text-base font-semibold text-white">What the contribution covers</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            {[
              ['Railway', 'Server hosting'],
              ['Netlify', 'Frontend hosting & CDN'],
              ['MongoDB Atlas', 'Database'],
              ['SendGrid', 'Email delivery (verification, password reset)'],
              ['football-data.org', 'Live fixture & results data'],
            ].map(([name, desc]) => (
              <li key={name} className="flex items-start gap-3">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <span className="font-medium text-slate-300">{name}</span>
                  {' — '}
                  {desc}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-5 text-sm text-slate-400 leading-relaxed">
          If you enjoy using Kickoff and want to say thanks, sharing it with friends who haven't
          joined yet is the best support you can give. Enjoy the tournament!
        </div>
      </div>
    </div>
  );
}
