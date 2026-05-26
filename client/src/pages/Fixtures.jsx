import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import MatchCard from '../components/MatchCard';

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

const FILTER_OPTIONS = [
  { value: '', label: 'All' },
  ...STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] })),
];

function groupByStageAndDate(matches) {
  const byStage = {};
  for (const m of matches) {
    if (!byStage[m.stage]) byStage[m.stage] = {};
    const day = new Date(m.kickoffTime).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    if (!byStage[m.stage][day]) byStage[m.stage][day] = [];
    byStage[m.stage][day].push(m);
  }
  return byStage;
}

export default function Fixtures() {
  const [stageFilter, setStageFilter] = useState('GROUP');

  const { data, isLoading, error } = useQuery({
    queryKey: ['matches', stageFilter],
    queryFn: () =>
      api.get('/matches', { params: stageFilter ? { stage: stageFilter } : {} }).then((r) => r.data),
    staleTime: 30_000,
  });

  const grouped = data ? groupByStageAndDate(data.matches) : {};

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Fixtures</h1>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          {FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/40 p-4 text-red-400">Failed to load fixtures</div>
      )}

      {!isLoading && data?.matches?.length === 0 && (
        <p className="text-center text-slate-400">No fixtures found for this stage.</p>
      )}

      {STAGE_ORDER.filter((s) => grouped[s]).map((stage) => (
        <section key={stage} className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-emerald-400">{STAGE_LABELS[stage]}</h2>
          {Object.entries(grouped[stage]).map(([day, matches]) => (
            <div key={day} className="mb-6">
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">{day}</h3>
              <div className="space-y-3">
                {matches.map((m) => (
                  <MatchCard key={m._id} match={m} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
