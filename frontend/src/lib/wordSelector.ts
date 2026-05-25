import { WORD_LIST } from '../data/wordlist';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Minimum number of words in the list that must contain a pattern for it to be worth promoting. */
const MIN_PRACTICE_WORDS = 5;

export function hasSufficientCoverage(pattern: string): boolean {
  let count = 0;
  for (const w of WORD_LIST) {
    if (w.includes(pattern)) { count++; if (count >= MIN_PRACTICE_WORDS) return true; }
  }
  return false;
}

/** Word length range per difficulty level (1–4). */
function difficultyRange(level: number): [number, number] {
  if (level <= 1) return [3, 5];
  if (level === 2) return [4, 7];
  if (level === 3) return [5, 9];
  return [6, 14];
}

/**
 * Generate one line of `count` words.
 *
 * With practice patterns:
 *   - Every word must contain at least one pattern.
 *   - If the difficulty-filtered pool doesn't have enough, fall back to the full list.
 *   - If even the full list can't fill the line, pad with random words.
 *
 * Without practice patterns:
 *   - Draw from the difficulty-appropriate word-length range (harder as level rises).
 */
export function generateLine(
  ngrams: Record<string, number>,
  count = 12,
  difficulty = 1,
): string[] {
  const ngramKeys = Object.keys(ngrams);
  const [minLen, maxLen] = difficultyRange(difficulty);

  if (ngramKeys.length === 0) {
    // No patterns — just use difficulty-ranged random words
    const pool = WORD_LIST.filter(w => w.length >= minLen && w.length <= maxLen);
    const src = pool.length >= count ? pool : WORD_LIST;
    return shuffle(src).slice(0, count);
  }

  const hasPattern = (w: string) => ngramKeys.some(ng => w.includes(ng));

  // Prefer difficulty range; fall back to full list if too few pattern words
  const diffPool = WORD_LIST.filter(w => w.length >= minLen && w.length <= maxLen && hasPattern(w));
  const practicePool = diffPool.length >= count ? diffPool : WORD_LIST.filter(hasPattern);

  // Cycle through all pattern words before repeating any — every word always contains the pattern
  const result: string[] = [];
  let cycle = shuffle([...practicePool]);
  let ci = 0;
  while (result.length < count) {
    if (ci >= cycle.length) { cycle = shuffle([...practicePool]); ci = 0; }
    result.push(cycle[ci++]);
  }
  return result;
}
