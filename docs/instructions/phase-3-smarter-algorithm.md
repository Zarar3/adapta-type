# Phase 3 — Smarter Adaptive Algorithm: Implementation Instructions

> **Self-contained.** Read this file only. Implement features in the order listed.
> After each feature, run `cd frontend && npx tsc --noEmit`.

---

## What This Phase Adds

1. **N-gram weight decay** — patterns promoted a long time ago silently age out so the focus set doesn't get stale
2. **Cross-session ngram persistence** — carry your active focus patterns between browser sessions
3. **Bigram heatmap** — visual bar charts in the results screen showing your slowest and most error-prone bigrams

---

## Codebase Snapshot (before changes)

### `frontend/src/lib/ngramTracker.ts` — full exports

```ts
// Types
export type NgramStats = Record<string, { seen: number; errors: number; totalMs: number; timedCount: number; }>;
export type StoredTiming = Record<string, { totalMs: number; count: number }>;
export interface SlowPattern { ng: string; label: 'slow' | 'very slow'; improved: boolean; currentlySlow: boolean; count: number; }

// Functions
export function updateNgramStats(word, charIndex, isCorrect, stats, deltaMs): NgramStats
export function saveTimingToStorage(stats: NgramStats): void
export function loadStoredTiming(): StoredTiming
export function getSessionCount(): number
export function incrementSessionCount(): void
export function getSlowPatterns(): SlowPattern[]
export function getFlaggedSlowKeys(): string[]
export function promoteNgrams(word, stats, currentNgrams, graduated): Record<string, number>
export function loadStrugglingPatterns(): Record<string, { rate: number; practiceCount: number }>
export function updateStrugglingPatterns(ngramStats, ngramGraduated): void
export function markPatternPracticed(pattern): void
export { ERROR_MIN, ERROR_RATE_MIN }
```

### `frontend/src/hooks/useTypingEngine.ts` — `EngineState` interface

```ts
interface EngineState {
  testState: TestState;
  duration: TimedMode;
  timeLeft: number;
  line: LineData;
  currentWord: number;
  currentChar: number;
  ngrams: Record<string, number>;          // active focus n-gram weights
  slowNgramKeys: Record<string, true>;
  ngramStreaks: Record<string, number>;
  ngramGraduated: Record<string, number>;
  ngramStats: NgramStats;
  ngramDisplayOrder: string[];
  ngramWaitQueue: string[];
  recentWords: string[];
  focusedPattern: string | null;
  difficultyLevel: number;
  difficultyHistory: DifficultyChange[];
  showLineHint: boolean;
  perfectWordStreak: number;
  longestPerfectStreak: number;
  errorWordStreak: number;
  currentWordHadError: boolean;
  correctChars: number;
  totalChars: number;
  errorCount: number;
  wpmHistory: WpmDataPoint[];
  results: TestResults | null;
}
```

### Key existing functions in `useTypingEngine.ts`

```ts
function buildInitialState(duration: TimedMode): EngineState   // seeds slow patterns from localStorage

// Inside finishTest:
saveTimingToStorage(s.ngramStats);
updateStrugglingPatterns(s.ngramStats, s.ngramGraduated);
incrementSessionCount();

// Inside reset():
setState(buildInitialState(duration));

// Inside changeDuration():
setState(buildInitialState(d));
```

### localStorage keys in use (do not conflict)

```
adapta-type-timing           — cumulative bigram timing
adapta-type-flagged-slow     — ever-flagged slow patterns
adapta-type-struggling       — error-based persistent patterns
adapta-type-patterns         — pattern wall library
adapta-type-session-count    — test count
adapta-type-sound            — sound preference
adapta-type-theme            — light/dark preference
```

### `frontend/src/components/Results/ResultsScreen.tsx` — where to insert heatmap

The heatmap goes after the existing pattern breakdown section (the `<div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 sm:p-6 mb-8">` block containing "pattern breakdown"), before the restart button.

---

## Feature 1 — N-gram Weight Decay

### Concept

Each active n-gram accrues an "age" (word count since promotion). After `DECAY_THRESHOLD = 40` words without a new error on that pattern, it silently graduates — removed from active focus without earning a streak. This prevents the active set from getting crowded with patterns from a long time ago.

### Changes to `useTypingEngine.ts`

**Add to `EngineState`:**
```ts
ngramAges: Record<string, number>;  // words typed since this ngram was promoted
```

**Add to `buildInitialState` return:**
```ts
ngramAges: {},
```

**In the space-press branch of `handleKeyDown`,** after computing `updatedNgrams` and before building `shared`, add:

```ts
const DECAY_THRESHOLD = 40;

// Increment age of every currently-active ngram
const updatedAges: Record<string, number> = {};
for (const ng of Object.keys(updatedNgrams)) {
  updatedAges[ng] = (next.ngramAges[ng] ?? 0) + 1;
}

// Newly promoted patterns start at age 0
for (const ng of newlyPromoted) {
  updatedAges[ng] = 0;
}

// Age out stale patterns — only if they had no NEW error this word
const erroredThisWord = new Set(
  Object.entries(promoted)
    .filter(([ng]) => {
      const before = next.ngramStats[ng];
      const after = updatedStats[ng];
      return after && before && after.errors > before.errors;
    })
    .map(([ng]) => ng)
);

const agedOutNgrams = new Set<string>();
for (const [ng, age] of Object.entries(updatedAges)) {
  if (age > DECAY_THRESHOLD && !erroredThisWord.has(ng)) {
    agedOutNgrams.add(ng);
    delete updatedAges[ng];
    // Remove from display order and wait queue
    const dIdx = displayOrder.indexOf(ng);
    if (dIdx !== -1) {
      displayOrder.splice(dIdx, 1);
      if (waitQueue.length > 0) displayOrder.push(waitQueue.shift()!);
    }
    const qIdx = waitQueue.indexOf(ng);
    if (qIdx !== -1) waitQueue.splice(qIdx, 1);
  }
}

// Remove aged-out from updatedNgrams
for (const ng of agedOutNgrams) {
  delete updatedNgrams[ng];
  delete updatedStreaks[ng];
  // Do NOT add to ngramGraduated — these are silent expirations
}
```

**Add `ngramAges: updatedAges` to the `shared` object.**

No localStorage changes needed — ages reset each test.

---

## Feature 2 — Cross-Session Ngram Persistence

### Concept

When a test ends, the active `ngrams` map is saved to localStorage. The next time the engine initialises, these patterns are merged in alongside the slow patterns. An explicit restart (Tab+Enter, clicking restart) clears the saved state so the user starts fresh on demand.

### New localStorage key

`adapta-type-active-ngrams` → `Record<string, number>` (same shape as `ngrams`)

### Changes to `frontend/src/lib/ngramTracker.ts`

Add three functions at the bottom of the file:

```ts
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
```

### Changes to `frontend/src/hooks/useTypingEngine.ts`

**Import the three new functions:**
```ts
import { ..., saveActiveNgrams, loadActiveNgrams, clearActiveNgrams } from '../lib/ngramTracker';
```

**In `finishTest`**, after `saveTimingToStorage(s.ngramStats)`:
```ts
saveActiveNgrams(s.ngrams);
```

**In `buildInitialState`**, merge persisted ngrams into the initial focus set:
```ts
function buildInitialState(duration: TimedMode): EngineState {
  const slowPatterns = getSlowPatterns();
  const slowNgrams = Object.fromEntries(slowPatterns.map(p => [p.ng, 1]));
  const slowNgramKeys = Object.fromEntries(slowPatterns.map(p => [p.ng, true as const]));

  // Merge persisted active ngrams (patterns from previous session)
  const persistedNgrams = loadActiveNgrams();
  const mergedNgrams = { ...persistedNgrams, ...slowNgrams }; // slow patterns take precedence on collision

  return {
    // ...
    ngrams: mergedNgrams,
    // rest unchanged
  };
}
```

**In `reset()`**, call `clearActiveNgrams()` before `setState`:
```ts
const reset = useCallback(() => {
  stopTicker();
  clearActiveNgrams();     // ← add this
  secondCountRef.current = 0;
  startTimeRef.current = null;
  setState(buildInitialState(duration));
}, [duration, stopTicker]);
```

**In `changeDuration()`**, also clear:
```ts
const changeDuration = useCallback((d: TimedMode) => {
  stopTicker();
  clearActiveNgrams();     // ← add this
  setDuration(d);
  setState(buildInitialState(d));
}, [stopTicker]);
```

Focused sessions (`startFocusedSession`) do NOT clear — the persisted patterns stay and will be reloaded on the next normal test.

---

## Feature 3 — Bigram Heatmap

### Concept

Two horizontal bar charts shown in the results screen after the pattern breakdown section, gated behind `sessionCount >= 3`:
- **Slowest bigrams** — from `adapta-type-timing`: top 8 by average ms vs. overall average, color-coded
- **Most error-prone bigrams** — from `adapta-type-struggling`: top 8 by error rate

No new data collection needed — both data sources already exist.

### New component: `frontend/src/components/Results/BigramHeatmap.tsx`

```tsx
import { loadStoredTiming, loadStrugglingPatterns } from '../../lib/ngramTracker';

interface TimingBar { ng: string; avgMs: number; ratio: number; }
interface ErrorBar  { ng: string; rate: number; practiceCount: number; }

export function BigramHeatmap() {
  const timing = loadStoredTiming();
  const struggling = loadStrugglingPatterns();

  // Compute overall average ms
  const entries = Object.entries(timing).filter(([, t]) => t.count >= 3);
  const totalMs = entries.reduce((s, [, t]) => s + t.totalMs, 0);
  const totalCount = entries.reduce((s, [, t]) => s + t.count, 0);
  const overallAvg = totalCount > 0 ? totalMs / totalCount : 1;

  const timingBars: TimingBar[] = entries
    .map(([ng, t]) => ({ ng, avgMs: t.totalMs / t.count, ratio: (t.totalMs / t.count) / overallAvg }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);

  const errorBars: ErrorBar[] = Object.entries(struggling)
    .map(([ng, e]) => ({ ng, rate: e.rate, practiceCount: e.practiceCount }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);

  if (timingBars.length === 0 && errorBars.length === 0) return null;

  const barColor = (ratio: number) =>
    ratio >= 2.0 ? '#f87171'    // red — very slow
    : ratio >= 1.5 ? '#fb923c'  // orange — slow
    : ratio >= 1.0 ? '#facc15'  // yellow — average
    : '#4ade80';                 // green — fast

  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 sm:p-6 mb-8">
      <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4">bigram profile</h3>

      {timingBars.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">slowest sequences (vs your average)</p>
          <div className="space-y-1.5">
            {timingBars.map(({ ng, ratio }) => (
              <div key={ng} className="flex items-center gap-3">
                <span className="font-mono text-sm w-8 text-gray-600 dark:text-gray-400 text-right">{ng}</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(ratio / 3, 1) * 100}%`,
                      backgroundColor: barColor(ratio),
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 w-10 text-right">{ratio.toFixed(1)}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {errorBars.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">highest error rates</p>
          <div className="space-y-1.5">
            {errorBars.map(({ ng, rate }) => (
              <div key={ng} className="flex items-center gap-3">
                <span className="font-mono text-sm w-8 text-gray-600 dark:text-gray-400 text-right">{ng}</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-red-400 transition-all"
                    style={{ width: `${Math.min(rate, 1) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 w-10 text-right">{Math.round(rate * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Wire into `ResultsScreen.tsx`

Import and add after the pattern breakdown `<div>`, before the restart button:

```tsx
import { BigramHeatmap } from './BigramHeatmap';

// Inside the component, after the pattern breakdown block:
{sessionCount >= 3 && <BigramHeatmap />}
```

`getSessionCount()` is already imported in `ResultsScreen.tsx`.

---

## Verification

```bash
cd frontend && npx tsc --noEmit   # zero errors
npm run test                       # all tests pass
```

Manual smoke tests:

**Decay:**
1. Start a 120s test. Make errors on a pattern to promote it.
2. Then type ~45 correct words without triggering that pattern's error again.
3. The chip for that pattern should disappear from the "focusing on" row before the test ends.

**Cross-session persistence:**
1. Start a test, get a pattern promoted (deliberate errors on e.g. "th").
2. End or finish the test — pattern is saved.
3. Refresh the page.
4. Start a new test — the "th" pattern should already be in the active focus (yellow chip visible or words containing "th" generated).
5. Click restart (Tab+Enter) — the persisted pattern clears.

**Bigram heatmap:**
1. Complete 3 or more tests.
2. On the results screen, scroll past the pattern breakdown — two bar chart sections should appear ("slowest sequences" and "highest error rates").
3. Bars should be color-coded correctly (red = very slow, green = fast).
