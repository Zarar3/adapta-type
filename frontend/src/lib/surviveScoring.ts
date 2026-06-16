// Survive-mode score multipliers that reward clean, fast typing.
// Shared by the scoring engine and the live HUD so thresholds never drift.

export function accuracyScoreMult(acc: number): number {
  if (acc >= 95) return 1.5;
  if (acc >= 90) return 1.25;
  if (acc >= 85) return 1.1;
  return 1;
}

export function wpmScoreMult(wpm: number): number {
  if (wpm >= 120) return 2.5;
  if (wpm >= 100) return 2;
  if (wpm >= 80) return 1.5;
  if (wpm >= 60) return 1.25;
  if (wpm >= 50) return 1.15;
  if (wpm >= 40) return 1.1;
  return 1;
}

// Harder material is worth more: easy→1×, medium→1.1×, hard→1.25×, expert→1.5×.
export function difficultyScoreMult(level: number): number {
  return [1, 1.1, 1.25, 1.5][level - 1] ?? 1;
}
