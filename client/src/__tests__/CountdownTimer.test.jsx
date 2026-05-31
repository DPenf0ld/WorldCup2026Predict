import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CountdownTimer from '../components/CountdownTimer';

const FUTURE = new Date('2099-01-01T00:00:00Z');
const PAST = new Date('2000-01-01T00:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CountdownTimer', () => {
  it('renders nothing when the deadline has already passed', () => {
    const { container } = render(<CountdownTimer deadline={PAST} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a "Predict by" label so users know it is a prediction deadline', () => {
    render(<CountdownTimer deadline={FUTURE} />);
    expect(screen.getByText('Predict by')).toBeInTheDocument();
  });

  it('renders the countdown alongside the label', () => {
    render(<CountdownTimer deadline={FUTURE} />);
    // The countdown is present — exact value depends on fake clock but should be non-empty
    const pill = screen.getByText('Predict by').closest('span');
    expect(pill).toBeInTheDocument();
    // The pill must contain more than just the label (i.e. the timer value is present)
    expect(pill.textContent.replace('Predict by', '').trim()).not.toBe('');
  });

  it('shows days when the deadline is more than 24 hours away', () => {
    // 2 days from now
    const twoDays = new Date('2026-06-01T12:00:00Z').getTime() + 2 * 24 * 60 * 60 * 1000;
    render(<CountdownTimer deadline={new Date(twoDays)} />);
    expect(screen.getByText(/\dd/)).toBeInTheDocument();
  });

  it('shows hh:mm:ss format when under 24 hours remain', () => {
    // 6 hours from now
    const sixHours = new Date('2026-06-01T12:00:00Z').getTime() + 6 * 60 * 60 * 1000;
    render(<CountdownTimer deadline={new Date(sixHours)} />);
    // Should match HH:MM:SS pattern
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });
});
