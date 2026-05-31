import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyPredictions from '../pages/MyPredictions';

// Keep CountdownTimer simple so we can assert its presence without fighting timers
vi.mock('../components/CountdownTimer', () => ({
  default: ({ deadline }) => <span data-testid="countdown-timer">{deadline}</span>,
}));

vi.mock('../api/axios');

// Control useQuery / useMutation return values per test
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isSuccess: false })),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const FUTURE_DEADLINE = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
const PAST_DEADLINE = new Date(Date.now() - 60 * 1000).toISOString();

function makePrediction({ stage = 'GROUP', group = 'A', deadlinePast = false, resultEntered = false, pointsAwarded = null } = {}) {
  return {
    _id: `pred-${Math.random()}`,
    predictedHomeScore: 2,
    predictedAwayScore: 1,
    predictedPenaltyWinner: null,
    pointsAwarded,
    matchId: {
      _id: `match-${Math.random()}`,
      homeTeam: 'England',
      awayTeam: 'France',
      stage,
      group: stage === 'GROUP' ? group : undefined,
      kickoffTime: new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString(),
      predictionDeadline: deadlinePast ? PAST_DEADLINE : FUTURE_DEADLINE,
      resultEntered,
      homeScore: resultEntered ? 2 : null,
      awayScore: resultEntered ? 1 : null,
      penaltyWinner: null,
    },
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MyPredictions />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false });
  useQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
});

// ── Loading / error states ────────────────────────────────────────────────────

describe('loading and error states', () => {
  it('shows a spinner while loading', () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows an error message on failure', () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    renderPage();
    expect(screen.getByText(/failed to load predictions/i)).toBeInTheDocument();
  });

  it('prompts the user to go to Fixtures when there are no predictions', () => {
    useQuery.mockReturnValue({ data: { predictions: [] }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByText(/head to fixtures/i)).toBeInTheDocument();
  });
});

// ── Stage progress summary ────────────────────────────────────────────────────

describe('stage progress summary', () => {
  it('renders all seven stage rows', () => {
    useQuery.mockReturnValue({ data: { predictions: [] }, isLoading: false, error: null });
    renderPage();
    const labels = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Third-Place Play-off', 'Final'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows 0/N for all stages when there are no predictions', () => {
    useQuery.mockReturnValue({ data: { predictions: [] }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByText('0/72')).toBeInTheDocument(); // GROUP
    expect(screen.getByText('0/16')).toBeInTheDocument(); // R32
    expect(screen.getByText('0/8')).toBeInTheDocument();  // R16
    expect(screen.getByText('0/4')).toBeInTheDocument();  // QF
    expect(screen.getByText('0/2')).toBeInTheDocument();  // SF
    expect(screen.getAllByText('0/1')).toHaveLength(2);   // TP + F
  });

  it('reflects the correct count for each stage', () => {
    const predictions = [
      makePrediction({ stage: 'GROUP' }),
      makePrediction({ stage: 'GROUP' }),
      makePrediction({ stage: 'ROUND_OF_32' }),
    ];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByText('2/72')).toBeInTheDocument();
    expect(screen.getByText('1/16')).toBeInTheDocument();
  });

  it('shows a tick (✓) and green text when a stage is fully predicted', () => {
    // Easiest to verify by filling FINAL (only 1 match)
    const predictions = [makePrediction({ stage: 'FINAL' })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows a "Wait for qualifiers" hint on knockout stage rows that are not complete', () => {
    useQuery.mockReturnValue({ data: { predictions: [] }, isLoading: false, error: null });
    renderPage();
    const hints = screen.getAllByText(/wait for qualifiers/i);
    // Should appear for 6 knockout stages (R32, R16, QF, SF, TP, Final)
    expect(hints.length).toBe(6);
  });

  it('does not show the qualifier hint on the Group Stage row', () => {
    useQuery.mockReturnValue({ data: { predictions: [] }, isLoading: false, error: null });
    renderPage();
    const groupRow = screen.getByText('Group Stage').closest('div');
    expect(within(groupRow).queryByText(/wait for qualifiers/i)).toBeNull();
  });
});

// ── Editable vs read-only prediction cards ────────────────────────────────────

describe('editable cards', () => {
  it('shows score inputs when the prediction deadline has not passed', () => {
    const predictions = [makePrediction({ deadlinePast: false })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the CountdownTimer on editable cards', () => {
    const predictions = [makePrediction({ deadlinePast: false })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
  });

  it('shows an Update button on editable cards', () => {
    const predictions = [makePrediction({ deadlinePast: false })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
  });

  it('calls the mutation when Update is clicked', async () => {
    const mutate = vi.fn();
    useMutation.mockReturnValue({ mutate, isPending: false, isSuccess: false });
    const predictions = [makePrediction({ deadlinePast: false })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /update/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});

describe('read-only cards', () => {
  it('shows no score inputs when the deadline has passed', () => {
    const predictions = [makePrediction({ deadlinePast: true })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('shows no score inputs when the result is already entered', () => {
    const predictions = [makePrediction({ deadlinePast: false, resultEntered: true, pointsAwarded: 2 })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('displays the user\'s pick on a read-only card', () => {
    const predictions = [makePrediction({ deadlinePast: true })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByText('Your pick')).toBeInTheDocument();
    expect(screen.getByText('2–1')).toBeInTheDocument();
  });

  it('shows the result and points badge when resultEntered is true', () => {
    const predictions = [makePrediction({ deadlinePast: true, resultEntered: true, pointsAwarded: 3 })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByText('Result')).toBeInTheDocument();
    expect(screen.getByText('+3 pts')).toBeInTheDocument();
  });

  it('shows "Pending" when there is no result yet', () => {
    const predictions = [makePrediction({ deadlinePast: true, resultEntered: false })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

// ── Knockout stage warning ────────────────────────────────────────────────────

describe('knockout stage warning banner', () => {
  it('shows the warning banner for Round of 32 predictions', () => {
    const predictions = [makePrediction({ stage: 'ROUND_OF_32' })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByText(/check which teams have qualified/i)).toBeInTheDocument();
  });

  it('shows the warning banner for all knockout stages', () => {
    const stages = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];
    const predictions = stages.map((stage) => makePrediction({ stage }));
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    const warnings = screen.getAllByText(/check which teams have qualified/i);
    expect(warnings).toHaveLength(6);
  });

  it('does not show the warning banner for the Group Stage', () => {
    const predictions = [makePrediction({ stage: 'GROUP' })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.queryByText(/check which teams have qualified/i)).toBeNull();
  });
});

// ── Predictions grouped and sorted by stage ───────────────────────────────────

describe('stage grouping', () => {
  it('renders a section heading for each stage that has predictions', () => {
    const predictions = [
      makePrediction({ stage: 'GROUP' }),
      makePrediction({ stage: 'ROUND_OF_16' }),
    ];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    expect(screen.getByRole('heading', { name: /group stage/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /round of 16/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /round of 32/i })).toBeNull();
  });

  it('shows X/Y counter in each stage section heading row', () => {
    const predictions = [makePrediction({ stage: 'GROUP' }), makePrediction({ stage: 'GROUP' })];
    useQuery.mockReturnValue({ data: { predictions }, isLoading: false, error: null });
    renderPage();
    // Should appear once in the progress summary and once in the section heading
    const all = screen.getAllByText('2/72');
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
