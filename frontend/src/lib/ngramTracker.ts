import type { CharState } from '../types';

/**
 * Extract n-grams from mistake positions in a completed word.
 * Only runs at word completion — never mid-word.
 * Skips n-grams whose length equals the whole word (avoids "mom" or "cat" as patterns).
 */
export function extractWordMistakeNgrams(
  word: string,
  charStates: CharState[],
  existing: Record<string, number>,
): Record<string, number> {
  const updated = { ...existing };

  for (let i = 0; i < word.length; i++) {
    if (charStates[i] !== 'incorrect') continue;

    // Bigrams containing position i
    if (i > 0) {
      const bg = word.slice(i - 1, i + 1);
      if (bg.length < word.length) updated[bg] = (updated[bg] ?? 0) + 1;
    }
    if (i < word.length - 1) {
      const bg = word.slice(i, i + 2);
      if (bg.length < word.length) updated[bg] = (updated[bg] ?? 0) + 1;
    }

    // Trigrams containing position i
    for (let start = Math.max(0, i - 2); start <= Math.min(i, word.length - 3); start++) {
      const tg = word.slice(start, start + 3);
      if (tg.length < word.length) updated[tg] = (updated[tg] ?? 0) + 1;
    }
  }

  return updated;
}
