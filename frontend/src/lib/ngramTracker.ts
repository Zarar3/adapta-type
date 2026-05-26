export type NgramStats = Record<string, {
  seen: number;
  errors: number;
  totalMs: number;    // cumulative ms across all timed keypresses for this bigram
  timedCount: number; // number of timed samples
}>;

export type StoredTiming = Record<string, { totalMs: number; count: number }>;

/**
 * Called on every regular character keypress.
 * Updates bigram (and trigram) stats for the sequence ending at charIndex.
 * Wrong keypresses are counted even if the user later backspaces and fixes them.
 */
export function updateNgramStats(
  word: string,
  charIndex: number,
  isCorrect: boolean,
  stats: NgramStats,
  deltaMs: number | null,
): NgramStats {
  if (charIndex < 1) return stats;
  const next = { ...stats };

  const addEntry = (ng: string) => {
    const e = next[ng] ?? { seen: 0, errors: 0, totalMs: 0, timedCount: 0 };
    next[ng] = {
      seen: e.seen + 1,
      errors: e.errors + (isCorrect ? 0 : 1),
      totalMs: e.totalMs + (deltaMs ?? 0),
      timedCount: e.timedCount + (deltaMs !== null ? 1 : 0),
    };
  };

  // Bigram ending at charIndex
  addEntry(word[charIndex - 1] + word[charIndex]);

  // Trigram ending at charIndex (when possible)
  if (charIndex >= 2) {
    addEntry(word[charIndex - 2] + word[charIndex - 1] + word[charIndex]);
  }

  return next;
}

const ERROR_MIN = 2;
const ERROR_RATE_MIN = 0.10;
const MIN_TIMING_SAMPLES = 3;
const SLOW_MULTIPLIER = 1.5;

function meetsErrorThreshold(entry: { seen: number; errors: number }): boolean {
  return entry.errors >= ERROR_MIN && entry.errors / entry.seen >= ERROR_RATE_MIN;
}

export function saveTimingToStorage(stats: NgramStats): void {
  try {
    const stored: StoredTiming = JSON.parse(localStorage.getItem('adapta-type-timing') ?? '{}');
    for (const [ng, entry] of Object.entries(stats)) {
      if (entry.timedCount === 0) continue;
      const prev = stored[ng] ?? { totalMs: 0, count: 0 };
      stored[ng] = { totalMs: prev.totalMs + entry.totalMs, count: prev.count + entry.timedCount };
    }
    localStorage.setItem('adapta-type-timing', JSON.stringify(stored));
  } catch {
    // localStorage unavailable — fail silently
  }
}

const SESSION_COUNT_KEY = 'adapta-type-session-count';

export function getSessionCount(): number {
  try { return parseInt(localStorage.getItem(SESSION_COUNT_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

export function incrementSessionCount(): void {
  try { localStorage.setItem(SESSION_COUNT_KEY, String(getSessionCount() + 1)); } catch { /* silent */ }
}

export function loadStoredTiming(): StoredTiming {
  try {
    return JSON.parse(localStorage.getItem('adapta-type-timing') ?? '{}');
  } catch {
    return {};
  }
}

export interface SlowPattern {
  ng: string;
  avgMs: number;
  overallAvgMs: number;
  ratio: number;
  count: number;
}

export function getSlowPatterns(): SlowPattern[] {
  const stored = loadStoredTiming();
  const entries = Object.entries(stored).filter(([, t]) => t.count >= MIN_TIMING_SAMPLES);
  if (entries.length === 0) return [];

  const totalMs = entries.reduce((s, [, t]) => s + t.totalMs, 0);
  const totalCount = entries.reduce((s, [, t]) => s + t.count, 0);
  const overallAvgMs = totalMs / totalCount;

  return entries
    .map(([ng, t]) => ({
      ng,
      avgMs: t.totalMs / t.count,
      overallAvgMs,
      ratio: (t.totalMs / t.count) / overallAvgMs,
      count: t.count,
    }))
    .filter(p => p.ratio >= SLOW_MULTIPLIER)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);
}

/**
 * Called once per word completion.
 * Promotes bigrams (or trigrams) from ngramStats to the active focus set
 * when they meet the error threshold or are consistently slow.
 */
export function promoteNgrams(
  word: string,
  stats: NgramStats,
  currentNgrams: Record<string, number>,
  graduated: Record<string, number>,
  storedTiming: StoredTiming,
  sessionAvgMs: number | null,
): Record<string, number> {
  const result = { ...currentNgrams };

  // Error-based promotion
  for (let i = 1; i < word.length; i++) {
    const bg = word[i - 1] + word[i];
    const bgEntry = stats[bg];

    if (!bgEntry || !meetsErrorThreshold(bgEntry)) continue;
    if (bg in result) continue;
    if (bg in graduated) continue;

    // Try to upgrade to a more specific trigram containing this bigram
    let promoted = bg;
    let promotedErrors = bgEntry.errors;

    if (i >= 2) {
      const tgLeft = word[i - 2] + word[i - 1] + word[i];
      const tgEntry = stats[tgLeft];
      if (tgEntry && meetsErrorThreshold(tgEntry) && !(tgLeft in graduated) && !(tgLeft in result)) {
        promoted = tgLeft;
        promotedErrors = tgEntry.errors;
      }
    }
    if (promoted === bg && i + 1 < word.length) {
      const tgRight = word[i - 1] + word[i] + word[i + 1];
      const tgEntry = stats[tgRight];
      if (tgEntry && meetsErrorThreshold(tgEntry) && !(tgRight in graduated) && !(tgRight in result)) {
        promoted = tgRight;
        promotedErrors = tgEntry.errors;
      }
    }

    result[promoted] = promotedErrors;
  }

  // Timing-based promotion (cross-session)
  if (sessionAvgMs !== null) {
    for (const [ng, timing] of Object.entries(storedTiming)) {
      if (ng in result || ng in graduated) continue;
      if (timing.count < MIN_TIMING_SAMPLES) continue;
      const avgMs = timing.totalMs / timing.count;
      if (avgMs > sessionAvgMs * SLOW_MULTIPLIER) {
        result[ng] = 1;
      }
    }
  }

  return result;
}
