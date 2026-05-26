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
    keyTotal += KEY_SCORE[word[i]] ?? 1.5;
    if (
      i > 0 &&
      FINGER[word[i]] !== undefined &&
      FINGER[word[i - 1]] !== undefined &&
      FINGER[word[i]] === FINGER[word[i - 1]]
    ) {
      keyTotal += SAME_FINGER_PENALTY;
    }
  }
  // 60% key difficulty (sum), 40% word length — so harder AND longer words rank higher
  return keyTotal * 0.6 + word.length * 0.4;
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
): string {
  const ngramKeys = Object.keys(ngrams);
  const tier = DIFFICULTY_TIERS[Math.min(Math.max(difficulty, 1), 4) - 1];

  if (ngramKeys.length === 0) {
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
