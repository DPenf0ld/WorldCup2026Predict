export const STAGES = {
  GROUP: 'GROUP',
  ROUND_OF_32: 'ROUND_OF_32',
  ROUND_OF_16: 'ROUND_OF_16',
  QUARTER_FINAL: 'QUARTER_FINAL',
  SEMI_FINAL: 'SEMI_FINAL',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL',
};

// Prediction deadline for each knockout stage: 1 hour before that stage begins.
// Adjust these dates if the schedule changes.
export const KNOCKOUT_DEADLINES = {
  [STAGES.ROUND_OF_32]: new Date('2026-07-04T12:00:00Z'),
  [STAGES.ROUND_OF_16]: new Date('2026-07-10T18:00:00Z'),
  [STAGES.QUARTER_FINAL]: new Date('2026-07-16T18:00:00Z'),
  [STAGES.SEMI_FINAL]: new Date('2026-07-21T21:00:00Z'),
  [STAGES.THIRD_PLACE]: new Date('2026-07-25T18:00:00Z'),
  [STAGES.FINAL]: new Date('2026-07-26T21:00:00Z'),
};

// Group stage predictions close 1 hour before each individual match.
export const GROUP_STAGE_DEADLINE_OFFSET_MS = 1 * 60 * 60 * 1000;

// All knockout stages — no draws possible. If level after extra time, penalties decide the winner.
export const KNOCKOUT_STAGES = new Set([
  STAGES.ROUND_OF_32,
  STAGES.ROUND_OF_16,
  STAGES.QUARTER_FINAL,
  STAGES.SEMI_FINAL,
  STAGES.THIRD_PLACE,
  STAGES.FINAL,
]);
