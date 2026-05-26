export type NgramStats = Record<string, { seen: number; errors: number }>;

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
): NgramStats {
  if (charIndex < 1) return stats;
  const next = { ...stats };

  // Bigram ending at charIndex
  const bg = word[charIndex - 1] + word[charIndex];
  const bEntry = next[bg] ?? { seen: 0, errors: 0 };
  next[bg] = { seen: bEntry.seen + 1, errors: bEntry.errors + (isCorrect ? 0 : 1) };

  // Trigram ending at charIndex (when possible)
  if (charIndex >= 2) {
    const tg = word[charIndex - 2] + word[charIndex - 1] + word[charIndex];
    const tEntry = next[tg] ?? { seen: 0, errors: 0 };
    next[tg] = { seen: tEntry.seen + 1, errors: tEntry.errors + (isCorrect ? 0 : 1) };
  }

  return next;
}

const ERROR_MIN = 2;
const ERROR_RATE_MIN = 0.25;

function meetsThreshold(entry: { seen: number; errors: number }): boolean {
  return entry.errors >= ERROR_MIN && entry.errors / entry.seen >= ERROR_RATE_MIN;
}

/**
 * Called once per word completion.
 * Promotes bigrams (or trigrams) from ngramStats to the active focus set
 * when they meet the error threshold. Each promoted bigram is upgraded to
 * a trigram if a qualifying trigram containing it exists in the same word.
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

    if (!bgEntry || !meetsThreshold(bgEntry)) continue;
    if (bg in result) continue;       // already promoted
    if (bg in graduated) continue;    // never re-promote

    // Try to upgrade to a more specific trigram containing this bigram
    let promoted = bg;
    let promotedErrors = bgEntry.errors;

    if (i >= 2) {
      const tgLeft = word[i - 2] + word[i - 1] + word[i];
      const tgEntry = stats[tgLeft];
      if (tgEntry && meetsThreshold(tgEntry) && !(tgLeft in graduated) && !(tgLeft in result)) {
        promoted = tgLeft;
        promotedErrors = tgEntry.errors;
      }
    }
    if (promoted === bg && i + 1 < word.length) {
      const tgRight = word[i - 1] + word[i] + word[i + 1];
      const tgEntry = stats[tgRight];
      if (tgEntry && meetsThreshold(tgEntry) && !(tgRight in graduated) && !(tgRight in result)) {
        promoted = tgRight;
        promotedErrors = tgEntry.errors;
      }
    }

    result[promoted] = promotedErrors;
  }

  return result;
}
