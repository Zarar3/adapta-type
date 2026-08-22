# N-Gram System — Deep Dive

The n-gram system is the core intelligence of Adapta-Type. This document explains every piece of it so you can reason about changes without re-reading all the code.

---

## What Is an N-Gram Here

A **bigram** is any 2-character sequence typed consecutively within a single word (e.g., `th`, `er`, `st`).  
A **trigram** is any 3-character sequence (e.g., `the`, `str`, `ion`).

N-grams never span word boundaries. Only the characters of the current word matter.

---

## Tracking: `updateNgramStats`

Called on **every single keypress** (including errors, including backspaced ones).

```
updateNgramStats(word, charIndex, isCorrect, stats, deltaMs) → NgramStats
```

- `charIndex < 1`: nothing tracked (first char has no predecessor)
- `charIndex >= 1`: tracks bigram `word[charIndex-1] + word[charIndex]`
- `charIndex >= 2`: also tracks trigram `word[charIndex-2] + word[charIndex-1] + word[charIndex]`
- `isCorrect = false` increments `errors` even if the user backspaces and fixes it later
- `deltaMs`: inter-keystroke timing; null if > 2000ms or at word start

**Why errors count even if fixed:** The wrong finger motion already happened. If you always mistype `th` and then fix it, you still have a `th` muscle memory problem.

---

## NgramStats Type

```typescript
Record<string, {
  seen: number;      // total keypresses recorded for this n-gram
  errors: number;    // wrong keypresses (permanent, even if backspaced)
  totalMs: number;   // cumulative timing across all samples
  timedCount: number; // number of timed samples (valid deltas only)
}>
```

---

## Promotion: `promoteNgrams`

Called once per word completion (on space key).

```
promoteNgrams(word, stats, currentNgrams, graduated) → Record<string, number>
```

Scans every bigram in the just-completed word. For each bigram that:
1. Meets the error threshold (`seen >= 4 AND errors >= 2 AND errors/seen >= 15%`)
2. Is not already in `currentNgrams` (active focus)
3. Is not in `graduated` (already mastered this run)

…it checks if the **trigram** containing that bigram also qualifies. If it does, promote the trigram instead of the bigram (more specific = better practice). Checks both left-extension (charIndex-2 + bigram) and right-extension (bigram + charIndex+1).

Result: the smallest qualifying n-gram that is maximally specific. `th` promotes to `the` if `the` also meets the threshold.

---

## Graduation: `updateStreaks`

Called on every word completion.

For each n-gram in the current focus set (`ngrams`):
1. Find the n-gram's first occurrence in the just-completed word
2. Check if ALL characters of that occurrence were typed correctly (no `incorrect` char states)
3. If yes: increment streak for that n-gram
4. If no: reset streak to 0 for that n-gram (other n-grams unaffected)
5. At streak >= 3: graduate — remove from `ngrams`, remove from `ngramStreaks`, delete from `ngramStats` (prevents re-promotion in same run), add to `ngramGraduated`

**Streak threshold:** 3 in all modes currently.

---

## Timing System

### Collection
- `lastKeypressTimeRef` tracks `performance.now()` of the previous keypress
- On space (word boundary): reset to null so the next word starts fresh
- Delta > 2000ms: treated as null (pause, not a timing measurement)
- Valid delta is passed to `updateNgramStats` → accumulates in `totalMs / timedCount`

### Persistence
`saveTimingToStorage(ngramStats)` called at test end.  
Merges current session's `totalMs` and `timedCount` into `adapta-type-timing` in localStorage.  
This is cumulative — data from every test ever played adds up.

### Slow Detection: `getSlowPatterns()`
1. Load all stored timing from `adapta-type-timing`
2. Filter to entries with `count >= 3` (minimum samples)
3. Compute overall average ms across all qualifying entries
4. Any bigram with `avgMs >= overallAvg * 1.5` is "slow"
5. Once slow, stored in `adapta-type-flagged-slow` permanently
6. Returns `SlowPattern[]` sorted by severity (very slow first, not improved before improved):

```typescript
interface SlowPattern {
  ng: string;
  label: 'slow' | 'very slow';  // ratio >= 2.0 = very slow
  improved: boolean;             // current ratio < flaggedRatio * 0.8
  count: number;
}
```

### Pre-seeding at Test Start
`buildInitialState` calls `getSlowPatterns()` and seeds all slow n-grams into `ngrams` with weight 1.  
They're also stored in `slowNgramKeys` so the "focusing on" chips can exclude them (they appear in results separately, not during the test).

---

## Struggling Pattern System

Separate from timing. Tracks error-based patterns persistently across sessions.

### Data Structure (`adapta-type-struggling`)
```typescript
Record<string, {
  rate: number;         // error rate when first flagged (errors/seen)
  practiceCount: number; // focused sessions completed for this pattern
}>
```

### `updateStrugglingPatterns(ngramStats, ngramGraduated)`
Called at test end, after `saveTimingToStorage`.

1. Remove any pattern in `ngramGraduated` (streak-cleared this run)
2. For each pattern in `ngramStats` with `errors > 0` AND not graduated: add to map if not already there
3. For each existing entry in map: if `practiceCount >= 3` AND `currentRate < storedRate / 1.5` → delete (auto-graduate)

### `markPatternPracticed(pattern)`
Called in `startFocusedSession` (when user clicks a pattern chip and picks a duration).  
Increments `practiceCount` for that pattern in the struggling map.

---

## The Full Lifecycle of an N-Gram

```
1. User types a word
   ↓
2. updateNgramStats fires on every keypress
   ↓
3. Word completes (space key)
   ↓
4. promoteNgrams checks all bigrams in the word
   → threshold met? → add to ngrams (active focus)
   ↓
5. Word generator now biases toward words containing this n-gram
   ↓
6. updateStreaks checks all active n-grams against the typed word
   → 3 consecutive correct? → graduate (remove from ngrams, add to ngramGraduated)
   ↓
7. Test ends
   ↓
8. saveTimingToStorage → persistent timing data
9. updateStrugglingPatterns → persistent error data
10. incrementSessionCount
   ↓
11. Results shown:
    - consistently slow: getSlowPatterns() [yellow]
    - still struggling: loadStrugglingPatterns() [red]
    - cleared: results.ngramGraduated [green]
```

---

## Constants Reference

| Constant | Value | File |
|---|---|---|
| `SEEN_MIN` | 4 | ngramTracker.ts |
| `ERROR_MIN` | 2 | ngramTracker.ts |
| `ERROR_RATE_MIN` | 0.15 (15%) | ngramTracker.ts |
| `MAX_DISPLAY_PATTERNS` | 3 | useTypingEngine.ts |
| `MIN_TIMING_SAMPLES` | 3 | ngramTracker.ts |
| `SLOW_MULTIPLIER` | 1.5 | ngramTracker.ts |
| Graduation streak | 3 | useTypingEngine.ts |
| Struggling grad threshold | rate / 1.5, count >= 3 | ngramTracker.ts |
