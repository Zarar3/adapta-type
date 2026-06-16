import { WORD_LIST } from '../data/wordlist';

const KEY_SCORE: Record<string, number> = {
  // Home row
  a: 1.0, s: 1.0, d: 1.0, f: 1.0, g: 1.3,
  h: 1.3, j: 1.0, k: 1.0, l: 1.0,
  // Top row
  q: 1.8, w: 1.4, e: 1.2, r: 1.2, t: 1.5,
  y: 1.5, u: 1.2, i: 1.2, o: 1.4, p: 1.8,
  // Bottom row
  z: 2.0, x: 1.8, c: 1.5, v: 1.5, b: 2.0,
  n: 1.5, m: 1.5,
};

// 0=L-pinky 1=L-ring 2=L-middle 3=L-index 4=R-index 5=R-middle 6=R-ring 7=R-pinky
const FINGER: Record<string, number> = {
  q: 0, a: 0, z: 0,
  w: 1, s: 1, x: 1,
  e: 2, d: 2, c: 2,
  r: 3, f: 3, v: 3, t: 3, g: 3, b: 3,
  y: 4, h: 4, n: 4, u: 4, j: 4, m: 4,
  i: 5, k: 5,
  o: 6, l: 6,
  p: 7,
};

const SAME_FINGER_PENALTY = 2.5;

// Keyboard geometry for the "stretch" penalty: how far the finger travels
// between consecutive keys. Letters only — non-letters fall back to home-row middle.
// 0 = bottom row, 1 = home row, 2 = top row
const KEY_ROW: Record<string, number> = {
  z: 0, x: 0, c: 0, v: 0, b: 0, n: 0, m: 0,
  a: 1, s: 1, d: 1, f: 1, g: 1, h: 1, j: 1, k: 1, l: 1,
  q: 2, w: 2, e: 2, r: 2, t: 2, y: 2, u: 2, i: 2, o: 2, p: 2,
};

// Column 0-9, left to right across the board
const KEY_COL: Record<string, number> = {
  q: 0, a: 0, z: 0,
  w: 1, s: 1, x: 1,
  e: 2, d: 2, c: 2,
  r: 3, f: 3, v: 3,
  t: 4, g: 4, b: 4,
  y: 5, h: 5, n: 5,
  u: 6, j: 6, m: 6,
  i: 7, k: 7,
  o: 8, l: 8,
  p: 9,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wordTypingScore(word: string): number {
  if (word.length === 0) return 0;
  let keyTotal = 0;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    keyTotal += KEY_SCORE[ch] ?? 1.5;
    if (i > 0) {
      const prev = word[i - 1];
      if (
        FINGER[ch] !== undefined &&
        FINGER[prev] !== undefined &&
        FINGER[ch] === FINGER[prev]
      ) {
        keyTotal += SAME_FINGER_PENALTY;
      }
      // Stretch penalty: how far the finger reaches between consecutive keys.
      const rowDist = Math.abs((KEY_ROW[ch] ?? 1) - (KEY_ROW[prev] ?? 1));
      const colDist = Math.abs((KEY_COL[ch] ?? 4) - (KEY_COL[prev] ?? 4));
      if (rowDist >= 2 || colDist >= 5) {
        keyTotal += 1.2; // large stretch (top↔bottom row or across the board)
      } else if (rowDist >= 1 && colDist >= 3) {
        keyTotal += 0.6; // moderate diagonal reach
      }
    }
  }
  // 55% key+stretch difficulty (sum), 45% word length — so harder AND longer words rank higher
  return keyTotal * 0.55 + word.length * 0.45;
}

// Use only the most common words for normal play; full list is available for pattern fallback
const COMMON_POOL_SIZE = 1500;
const _scored = WORD_LIST.slice(0, COMMON_POOL_SIZE).map(w => [w, wordTypingScore(w)] as [string, number])
  .sort((a, b) => a[1] - b[1]);
const _n = _scored.length;

const DIFFICULTY_TIERS: string[][] = [
  _scored.slice(0,                    Math.floor(_n * 0.30)).map(([w]) => w),
  _scored.slice(Math.floor(_n * 0.30), Math.floor(_n * 0.60)).map(([w]) => w),
  _scored.slice(Math.floor(_n * 0.60), Math.floor(_n * 0.80)).map(([w]) => w),
  _scored.slice(Math.floor(_n * 0.80)                       ).map(([w]) => w),
];

const MIN_PRACTICE_WORDS = 5;

export function hasSufficientCoverage(pattern: string): boolean {
  let count = 0;
  for (const w of WORD_LIST) {
    if (w.includes(pattern)) { count++; if (count >= MIN_PRACTICE_WORDS) return true; }
  }
  return false;
}

let _proactiveBigrams: string[] | null = null;

export function getProactiveBigrams(count = 6): string[] {
  if (_proactiveBigrams) return _proactiveBigrams.slice(0, count);

  const letters = Object.keys(FINGER);
  const freqMap: Record<string, number> = {};

  for (let i = 0; i < letters.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      if (i === j) continue;
      if (FINGER[letters[i]] !== FINGER[letters[j]]) continue;
      const bg = letters[i] + letters[j];
      let freq = 0;
      for (const w of WORD_LIST.slice(0, 1500)) {
        for (let k = 0; k < w.length - 1; k++) {
          if (w[k] === letters[i] && w[k + 1] === letters[j]) freq++;
        }
      }
      if (freq > 0) freqMap[bg] = freq;
    }
  }

  _proactiveBigrams = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .map(([bg]) => bg)
    .filter(hasSufficientCoverage);

  return _proactiveBigrams.slice(0, count);
}

export function generateWord(
  ngrams: Record<string, number>,
  difficulty = 1,
  exclude: string[] = [],
  bias = 1.0,
): string {
  const ngramKeys = Object.keys(ngrams);
  const tier = DIFFICULTY_TIERS[Math.min(Math.max(difficulty, 1), 4) - 1];

  if (ngramKeys.length === 0 || Math.random() >= bias) {
    const src = tier.length > 0 ? tier : WORD_LIST;
    const pool = src.filter(w => !exclude.includes(w));
    const pick = pool.length > 0 ? pool : src;
    return pick[Math.floor(Math.random() * pick.length)];
  }

  const hasPattern = (w: string) => ngramKeys.some(ng => w.includes(ng));
  const tierPool = tier.filter(hasPattern);
  const base = tierPool.length > 0 ? tierPool : WORD_LIST.filter(hasPattern);
  const pool = base.filter(w => !exclude.includes(w));
  const pick = pool.length > 0 ? pool : base;
  return pick[Math.floor(Math.random() * pick.length)];
}

export function generateWordContaining(
  pattern: string,
  difficulty: number,
  exclude: string[] = [],
): string {
  const tier = DIFFICULTY_TIERS[Math.min(Math.max(difficulty, 1), 4) - 1];
  const base = tier.filter(w => w.includes(pattern));
  const src = base.length > 0 ? base : WORD_LIST.filter(w => w.includes(pattern));
  const pool = src.filter(w => !exclude.includes(w));
  const pick = pool.length > 0 ? pool : src;
  if (pick.length === 0) return generateWord({ [pattern]: 1 }, difficulty, exclude, 1.0);
  return pick[Math.floor(Math.random() * pick.length)];
}

export function generateLine(
  ngrams: Record<string, number>,
  count = 12,
  difficulty = 1,
): string[] {
  const ngramKeys = Object.keys(ngrams);
  const tier = DIFFICULTY_TIERS[Math.min(Math.max(difficulty, 1), 4) - 1];

  if (ngramKeys.length === 0) {
    const src = tier.length >= count ? tier : WORD_LIST;
    return shuffle(src).slice(0, count);
  }

  const hasPattern = (w: string) => ngramKeys.some(ng => w.includes(ng));
  const tierPool = tier.filter(hasPattern);
  const practicePool = tierPool.length >= count ? tierPool : WORD_LIST.filter(hasPattern);

  const result: string[] = [];
  let cycle = shuffle([...practicePool]);
  let ci = 0;
  while (result.length < count) {
    if (ci >= cycle.length) { cycle = shuffle([...practicePool]); ci = 0; }
    result.push(cycle[ci++]);
  }
  return result;
}
