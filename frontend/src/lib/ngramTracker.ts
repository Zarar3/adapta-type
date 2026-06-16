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

  addEntry(word[charIndex - 1] + word[charIndex]);
  if (charIndex >= 2) {
    addEntry(word[charIndex - 2] + word[charIndex - 1] + word[charIndex]);
  }

  return next;
}

const ERROR_MIN = 1;
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
  } catch { /* silent */ }
}

const SESSION_COUNT_KEY = 'adapta-type-session-count';

export function getSessionCount(): number {
  try { return parseInt(localStorage.getItem(SESSION_COUNT_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

export function incrementSessionCount(): void {
  try { localStorage.setItem(SESSION_COUNT_KEY, String(getSessionCount() + 1)); } catch { /* silent */ }
}

export function loadStoredTiming(): StoredTiming {
  try { return JSON.parse(localStorage.getItem('adapta-type-timing') ?? '{}'); } catch { return {}; }
}

// Stores patterns that were ever flagged slow, along with ratio at time of flagging
const FLAGGED_KEY = 'adapta-type-flagged-slow';
interface FlaggedEntry { ratio: number }

function loadFlaggedMap(): Record<string, FlaggedEntry> {
  try { return JSON.parse(localStorage.getItem(FLAGGED_KEY) ?? '{}'); } catch { return {}; }
}
function saveFlaggedMap(map: Record<string, FlaggedEntry>): void {
  try { localStorage.setItem(FLAGGED_KEY, JSON.stringify(map)); } catch { /* silent */ }
}

export interface SlowPattern {
  ng: string;
  label: 'slow' | 'very slow';
  improved: boolean;     // current ratio is 20%+ better than when first flagged
  currentlySlow: boolean; // current avg is still ≥ SLOW_MULTIPLIER × overall avg
  count: number;
}

export function getSlowPatterns(): SlowPattern[] {
  const stored = loadStoredTiming();
  const entries = Object.entries(stored).filter(([, t]) => t.count >= MIN_TIMING_SAMPLES);

  if (entries.length > 0) {
    const totalMs = entries.reduce((s, [, t]) => s + t.totalMs, 0);
    const totalCount = entries.reduce((s, [, t]) => s + t.count, 0);
    const overallAvgMs = totalMs / totalCount;
    const flagged = loadFlaggedMap();
    let changed = false;
    for (const [ng, t] of entries) {
      const ratio = (t.totalMs / t.count) / overallAvgMs;
      if (ratio >= SLOW_MULTIPLIER && !(ng in flagged)) { flagged[ng] = { ratio }; changed = true; }
    }
    if (changed) saveFlaggedMap(flagged);
  }

  const flagged = loadFlaggedMap();
  if (Object.keys(flagged).length === 0) return [];

  const totalMs = entries.reduce((s, [, t]) => s + t.totalMs, 0);
  const totalCount = entries.reduce((s, [, t]) => s + t.count, 0);
  const overallAvgMs = totalCount > 0 ? totalMs / totalCount : 1;

  return Object.entries(flagged).map(([ng, { ratio: flaggedRatio }]) => {
    const t = stored[ng];
    const currentRatio = t && t.count > 0 ? (t.totalMs / t.count) / overallAvgMs : flaggedRatio;
    return {
      ng,
      label: (currentRatio >= 2 ? 'very slow' : 'slow') as SlowPattern['label'],
      improved: currentRatio < flaggedRatio * 0.8,
      currentlySlow: currentRatio >= SLOW_MULTIPLIER,
      count: t?.count ?? 0,
    };
  }).sort((a, b) => {
    if (a.improved !== b.improved) return a.improved ? 1 : -1;
    return (b.label === 'very slow' ? 1 : 0) - (a.label === 'very slow' ? 1 : 0);
  });
}

/** Returns the keys currently in adapta-type-flagged-slow before any merging. */
export function getFlaggedSlowKeys(): string[] {
  return Object.keys(loadFlaggedMap());
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
): Record<string, number> {
  const result = { ...currentNgrams };

  for (let i = 1; i < word.length; i++) {
    const bg = word[i - 1] + word[i];
    const bgEntry = stats[bg];

    if (!bgEntry || !meetsErrorThreshold(bgEntry)) continue;
    if (bg in result) continue;
    if (bg in graduated) continue;

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

  return result;
}

// ── Persistent struggling patterns ────────────────────────────────────────────
const STRUGGLING_KEY = 'adapta-type-struggling';

interface StrugglingEntry { rate: number; practiceCount: number; }
type StrugglingMap = Record<string, StrugglingEntry>;

export function loadStrugglingPatterns(): StrugglingMap {
  try { return JSON.parse(localStorage.getItem(STRUGGLING_KEY) ?? '{}'); } catch { return {}; }
}

function saveStrugglingMap(map: StrugglingMap): void {
  try { localStorage.setItem(STRUGGLING_KEY, JSON.stringify(map)); } catch { /* silent */ }
}

/**
 * Called at end of every test.
 * Adds any pattern with ≥1 error, removes streak-graduated ones,
 * and graduates patterns whose rate improved 1.5× after 3 practice sessions.
 */
export function updateStrugglingPatterns(
  ngramStats: NgramStats,
  ngramGraduated: Record<string, number>,
): void {
  const map = loadStrugglingMap();

  // Remove patterns streak-graduated this run
  for (const ng of Object.keys(ngramGraduated)) delete map[ng];

  // Add new patterns that had any error this run
  for (const [ng, stat] of Object.entries(ngramStats)) {
    if (stat.errors > 0 && !(ng in ngramGraduated) && !(ng in map)) {
      map[ng] = { rate: stat.errors / stat.seen, practiceCount: 0 };
    }
  }

  // Graduate patterns improved 1.5× after ≥3 practice sessions
  for (const ng of Object.keys(map)) {
    const stat = ngramStats[ng];
    if (!stat || stat.seen === 0) continue;
    const entry = map[ng];
    if (entry.practiceCount >= 3 && stat.errors / stat.seen < entry.rate / 1.5) {
      delete map[ng];
    }
  }

  saveStrugglingMap(map);
}

/** Called when a focused practice session starts for a pattern. */
export function markPatternPracticed(pattern: string): void {
  const map = loadStrugglingMap();
  if (pattern in map) {
    map[pattern] = { ...map[pattern], practiceCount: map[pattern].practiceCount + 1 };
    saveStrugglingMap(map);
  }
}

function loadStrugglingMap(): StrugglingMap {
  return loadStrugglingPatterns();
}

const ACTIVE_NGRAMS_KEY = 'adapta-type-active-ngrams';

export function saveActiveNgrams(ngrams: Record<string, number>): void {
  try { localStorage.setItem(ACTIVE_NGRAMS_KEY, JSON.stringify(ngrams)); } catch { /* silent */ }
}

export function loadActiveNgrams(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(ACTIVE_NGRAMS_KEY) ?? '{}'); } catch { return {}; }
}

export function clearActiveNgrams(): void {
  try { localStorage.removeItem(ACTIVE_NGRAMS_KEY); } catch { /* silent */ }
}

// Patterns that were visible (still unfinished) when the last session ended.
// Persists across plain restarts — NOT cleared by clearActiveNgrams — so the
// user keeps focusing on what they didn't graduate yet. Local-only, like all
// other tracking keys.
const FOCUS_CARRYOVER_KEY = 'adapta-type-focus-carryover';

export function saveFocusCarryover(list: string[]): void {
  try { localStorage.setItem(FOCUS_CARRYOVER_KEY, JSON.stringify(list)); } catch { /* silent */ }
}

export function loadFocusCarryover(): string[] {
  try { return JSON.parse(localStorage.getItem(FOCUS_CARRYOVER_KEY) ?? '[]'); } catch { return []; }
}

export function resetAllTracking(): void {
  try {
    localStorage.removeItem('adapta-type-timing');
    localStorage.removeItem(SESSION_COUNT_KEY);
    localStorage.removeItem(FLAGGED_KEY);
    localStorage.removeItem(STRUGGLING_KEY);
    localStorage.removeItem(ACTIVE_NGRAMS_KEY);
    localStorage.removeItem(FOCUS_CARRYOVER_KEY);
  } catch { /* silent */ }
}

export { ERROR_MIN, ERROR_RATE_MIN };

const SURVIVE_BEST_KEY = 'adapta-type-survive-best';
export function loadSurviveBest(): number {
  try { return parseInt(localStorage.getItem(SURVIVE_BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
export function saveSurviveBest(score: number): void {
  try { localStorage.setItem(SURVIVE_BEST_KEY, String(score)); } catch { /* silent */ }
}
