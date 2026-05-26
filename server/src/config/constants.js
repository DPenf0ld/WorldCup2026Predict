export const STAGES = {
  GROUP: 'GROUP',
  ROUND_OF_32: 'ROUND_OF_32',
  ROUND_OF_16: 'ROUND_OF_16',
  QUARTER_FINAL: 'QUARTER_FINAL',
  SEMI_FINAL: 'SEMI_FINAL',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL',
};

// Prediction deadline for each knockout stage: 72 hours before that stage begins.
// Adjust these dates if the schedule changes.
export const KNOCKOUT_DEADLINES = {
  [STAGES.ROUND_OF_32]: new Date('2026-07-01T18:00:00Z'),
  [STAGES.ROUND_OF_16]: new Date('2026-07-07T18:00:00Z'),
  [STAGES.QUARTER_FINAL]: new Date('2026-07-13T18:00:00Z'),
  [STAGES.SEMI_FINAL]: new Date('2026-07-18T18:00:00Z'),
  [STAGES.THIRD_PLACE]: new Date('2026-07-22T18:00:00Z'),
  [STAGES.FINAL]: new Date('2026-07-23T18:00:00Z'),
};

// Group stage predictions close 48 hours before each individual match.
export const GROUP_STAGE_DEADLINE_OFFSET_MS = 48 * 60 * 60 * 1000;

// Knockout stages cannot end in a draw — one team always advances (via penalties if needed).
export const KNOCKOUT_STAGES = new Set([
  STAGES.ROUND_OF_32,
  STAGES.ROUND_OF_16,
  STAGES.QUARTER_FINAL,
  STAGES.SEMI_FINAL,
  STAGES.THIRD_PLACE,
  STAGES.FINAL,
]);
