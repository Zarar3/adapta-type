# Phase 2 — More Modes: Implementation Instructions

> **Self-contained.** Read this file only. Implement top-to-bottom in the order listed.
> After each step, run `cd frontend && npx tsc --noEmit` to catch type errors early.

---

## What This Phase Adds

Four game modes selectable via a tab bar above the duration/count picker:
- **time** — existing timed test (unchanged logic)
- **words** — type N words, no timer (10 / 25 / 50 / 100)
- **quote** — type a real quote, fixed word order, ends when complete
- **custom** — paste your own text into a textarea, then type it

---

## Codebase Snapshot (current state before changes)

### `frontend/src/types/index.ts` — full current file

```ts
export type CharState = 'untyped' | 'correct' | 'incorrect' | 'extra';

export interface WpmDataPoint {
  t: number;
  wpm: number;
  raw: number;
  errors: number;
}

export interface DifficultyChange {
  t: number;
  level: number;
}

export interface TestResults {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;
  peakWpm: number;
  longestPerfectStreak: number;
  wpmHistory: WpmDataPoint[];
  ngramMistakes: Record<string, number>;
  ngramFocused: string[];
  preRunSlowKeys: string[];
  ngramGraduated: Record<string, number>;
  difficultyHistory: DifficultyChange[];
}

export type TestState = 'idle' | 'running' | 'finished';
export type TimedMode = 15 | 30 | 60 | 120 | 'infinite';
```

### `frontend/src/hooks/useTypingEngine.ts` — `EngineState` interface (current)

```ts
interface EngineState {
  testState: TestState;
  duration: TimedMode;
  timeLeft: number;
  line: LineData;
  currentWord: number;
  currentChar: number;
  ngrams: Record<string, number>;
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

### `frontend/src/hooks/useTypingEngine.ts` — `buildInitialState` (current)

```ts
function buildInitialState(duration: TimedMode): EngineState {
  const slowPatterns = getSlowPatterns();
  const slowNgrams = Object.fromEntries(slowPatterns.map(p => [p.ng, 1]));
  const slowNgramKeys = Object.fromEntries(slowPatterns.map(p => [p.ng, true as const]));
  return {
    testState: 'idle',
    duration,
    timeLeft: duration === 'infinite' ? 0 : duration,
    line: makeLineData(generateLine(slowNgrams, 3, 1)),
    currentWord: 0,
    currentChar: 0,
    ngrams: slowNgrams,
    slowNgramKeys,
    ngramStreaks: {},
    ngramGraduated: {},
    ngramStats: {},
    ngramDisplayOrder: [],
    ngramWaitQueue: [],
    recentWords: [],
    focusedPattern: null,
    difficultyLevel: 1,
    difficultyHistory: [],
    showLineHint: true,
    perfectWordStreak: 0,
    longestPerfectStreak: 0,
    errorWordStreak: 0,
    currentWordHadError: false,
    correctChars: 0,
    totalChars: 0,
    errorCount: 0,
    wpmHistory: [],
    results: null,
  };
}
```

### `frontend/src/lib/wordSelector.ts` — relevant exports

```ts
export function generateWord(ngrams, difficulty, exclude, bias): string
export function generateLine(ngrams, count, difficulty): string[]
export function hasSufficientCoverage(pattern: string): boolean
```

### `frontend/src/components/TypingTest/TimerBar.tsx` — full current file

```tsx
import type { TestState, TimedMode } from '../../types';

interface Props {
  testState: TestState;
  timeLeft: number;
  duration: TimedMode;
  onChangeDuration: (d: TimedMode) => void;
}

const MODES: TimedMode[] = [15, 30, 60, 120, 'infinite'];

export function TimerBar({ testState, timeLeft, duration, onChangeDuration }: Props) {
  if (testState === 'running') {
    return (
      <div className="flex justify-center mb-6">
        <span className="text-3xl font-mono font-bold text-yellow-400">{timeLeft}</span>
      </div>
    );
  }

  if (testState === 'idle') {
    return (
      <div className="flex justify-center gap-2 sm:gap-3 mb-6 flex-wrap">
        {MODES.map(m => (
          <button
            key={m}
            onClick={() => onChangeDuration(m)}
            className={`px-3 sm:px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              m === duration
                ? 'bg-yellow-400 text-gray-900'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {m === 'infinite' ? '∞' : `${m}s`}
          </button>
        ))}
      </div>
    );
  }

  return null;
}
```

### `frontend/src/App.tsx` — current return signature from `useTypingEngine`

```ts
const { state, handleKeyDown, reset, changeDuration, startFocusedSession, endTest } = useTypingEngine();
```

---

## Step 1 — Extend `frontend/src/types/index.ts`

Add these exports to the bottom of the file:

```ts
export type GameMode = 'timed' | 'words' | 'quote' | 'custom';
export type WordCountTarget = 10 | 25 | 50 | 100;

export interface Quote {
  text: string;
  author: string;
  source?: string;
}

// Add optional field to TestResults:
// quote?: Quote;
```

Also modify `TestResults` to add `quote?: Quote` as an optional field.

---

## Step 2 — Create `frontend/src/data/quotes.ts`

Create a file with 40 curated quotes. Format:

```ts
import type { Quote } from '../types';

export const QUOTES: Quote[] = [
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "Programs must be written for people to read, and only incidentally for machines to execute.",
    author: "Harold Abelson",
    source: "Structure and Interpretation of Computer Programs",
  },
  // ... 38 more
];
```

Include a mix of: programming wisdom (~15), literature (~10), philosophy (~10), science (~5).
Keep texts between 8 and 60 words. No quotes containing numbers, special punctuation beyond commas/periods/apostrophes, or em-dashes (keep it typeable).

---

## Step 3 — Extend `EngineState` in `useTypingEngine.ts`

Add these fields to the `EngineState` interface:

```ts
gameMode: GameMode;
wordTarget: number | null;    // word-count mode: 10 | 25 | 50 | 100
wordsCompleted: number;       // increments on every space press
fixedWords: string[] | null;  // quote/custom: full pre-split word list
fixedWordOffset: number;      // next index to serve from fixedWords
currentQuote: Quote | null;
```

Add corresponding imports at top of file:
```ts
import type { ..., GameMode, Quote } from '../types';
```

---

## Step 4 — Extend `buildInitialState`

Change signature to:
```ts
interface ModeOpts {
  wordTarget?: WordCountTarget;
  fixedWords?: string[];
  quote?: Quote;
}

function buildInitialState(
  duration: TimedMode,
  gameMode: GameMode = 'timed',
  opts: ModeOpts = {},
): EngineState
```

Add new fields to the returned object:
```ts
gameMode,
wordTarget: opts.wordTarget ?? null,
wordsCompleted: 0,
fixedWords: opts.fixedWords ?? null,
fixedWordOffset: 0,
currentQuote: opts.quote ?? null,
```

For the initial `line`: if `opts.fixedWords` is provided, use the first 3 words instead of `generateLine`:
```ts
line: opts.fixedWords
  ? makeLineData(opts.fixedWords.slice(0, 3))
  : makeLineData(generateLine(slowNgrams, 3, 1)),
```

---

## Step 5 — Modify space-press logic in `handleKeyDown`

Inside the `e.key === ' ' && currentChar === word.length` branch, after computing `updatedRecent` and `shared`:

**Word-count mode:** before generating `nextWord`, check:
```ts
if (next.gameMode === 'words' && next.wordsCompleted + 1 >= (next.wordTarget ?? Infinity)) {
  // Test is done — call finishTest after setState
  // Add wordsCompleted increment to shared, then call finishTest outside setState
  return { ...next, ...shared, wordsCompleted: next.wordsCompleted + 1 };
}
```
After the `setState` call returns, detect that wordsCompleted hit target and call `finishTest`.
The cleanest pattern: add a `useEffect` watching `state.gameMode === 'words' && state.wordsCompleted >= (state.wordTarget ?? Infinity) && state.testState === 'running'` → call `finishTest(stateRef.current)`. Mirror the existing `timeLeft` watcher pattern.

**Quote/custom mode:** instead of `generateWord(...)`, advance the fixed word window:
```ts
if (next.fixedWords) {
  const nextOffset = next.fixedWordOffset + 1;
  if (nextOffset + 2 >= next.fixedWords.length) {
    // Last word completed — finish test
    return { ...next, ...shared, wordsCompleted: next.wordsCompleted + 1, fixedWordOffset: nextOffset };
  }
  const newWords = next.fixedWords.slice(nextOffset, nextOffset + 3);
  return {
    ...next,
    ...shared,
    wordsCompleted: next.wordsCompleted + 1,
    fixedWordOffset: nextOffset,
    showLineHint: false,
    line: { words: newWords, charStates: newWords.map(w => Array(w.length).fill('untyped')) },
    currentWord: 0,
    currentChar: 0,
  };
}
```
Add a `useEffect` for `fixedWords` finish: watch `state.fixedWordOffset + 2 >= (state.fixedWords?.length ?? Infinity) && state.testState === 'running' && state.wordsCompleted > 0`.

Also increment `wordsCompleted` in all space-press returns:
```ts
wordsCompleted: next.wordsCompleted + 1,
```

---

## Step 6 — Add new session starters to `useTypingEngine.ts`

```ts
const startWordCountSession = useCallback((target: WordCountTarget) => {
  stopTicker();
  secondCountRef.current = 0;
  const dur: TimedMode = 'infinite'; // word-count uses infinite timer internally
  setDuration(dur);
  setState(buildInitialState(dur, 'words', { wordTarget: target }));
}, [stopTicker]);

const startQuoteSession = useCallback((quote: Quote) => {
  stopTicker();
  secondCountRef.current = 0;
  const words = quote.text.split(/\s+/).filter(Boolean);
  setDuration('infinite');
  setState(buildInitialState('infinite', 'quote', { fixedWords: words, quote }));
}, [stopTicker]);

const startCustomSession = useCallback((text: string) => {
  stopTicker();
  secondCountRef.current = 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return; // too short
  setDuration('infinite');
  setState(buildInitialState('infinite', 'custom', { fixedWords: words }));
}, [stopTicker]);
```

Export these from the hook's return object alongside existing exports.

Also add `quote: s.currentQuote` to the `results` object inside `finishTest`:
```ts
const results: TestResults = {
  // ... existing fields ...
  quote: s.currentQuote ?? undefined,
};
```

---

## Step 7 — Rewrite `frontend/src/components/TypingTest/TimerBar.tsx`

The component now also receives `gameMode`, `wordTarget`, `wordsCompleted`, and mode-change callbacks. Full new interface:

```ts
import type { TestState, TimedMode, GameMode, WordCountTarget } from '../../types';

interface Props {
  testState: TestState;
  timeLeft: number;
  duration: TimedMode;
  gameMode: GameMode;
  wordTarget: WordCountTarget | null;
  wordsCompleted: number;
  onChangeDuration: (d: TimedMode) => void;
  onChangeMode: (m: GameMode) => void;
  onChangeWordTarget: (t: WordCountTarget) => void;
}
```

**Idle state rendering:**

```tsx
// Mode tab bar — always shown when idle
<div className="flex justify-center gap-1 mb-4">
  {(['timed', 'words', 'quote', 'custom'] as GameMode[]).map(m => (
    <button
      key={m}
      onClick={() => onChangeMode(m)}
      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
        m === gameMode
          ? 'text-yellow-400 border-b border-yellow-400'
          : 'text-gray-500 hover:text-gray-300 dark:text-gray-600 dark:hover:text-gray-400'
      }`}
    >
      {m}
    </button>
  ))}
</div>

// Sub-options per mode
{gameMode === 'timed' && (
  <div className="flex justify-center gap-2 mb-6 flex-wrap">
    {([15, 30, 60, 120, 'infinite'] as TimedMode[]).map(m => (
      <button key={m} onClick={() => onChangeDuration(m)}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          m === duration ? 'bg-yellow-400 text-gray-900'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}>
        {m === 'infinite' ? '∞' : `${m}s`}
      </button>
    ))}
  </div>
)}
{gameMode === 'words' && (
  <div className="flex justify-center gap-2 mb-6">
    {([10, 25, 50, 100] as WordCountTarget[]).map(t => (
      <button key={t} onClick={() => onChangeWordTarget(t)}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          t === wordTarget ? 'bg-yellow-400 text-gray-900'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}>
        {t}
      </button>
    ))}
  </div>
)}
{/* quote and custom: no sub-options shown here (handled in TypingArea) */}
```

**Running state rendering:**

```tsx
if (testState === 'running') {
  if (gameMode === 'words') {
    return (
      <div className="flex justify-center mb-6">
        <span className="text-lg font-mono text-gray-500 dark:text-gray-400">
          <span className="text-yellow-400 font-bold">{wordsCompleted}</span>
          <span className="text-gray-600"> / {wordTarget}</span>
        </span>
      </div>
    );
  }
  if (gameMode === 'quote' || gameMode === 'custom') {
    return null; // no timer display for fixed-text modes
  }
  // timed (existing)
  return (
    <div className="flex justify-center mb-6">
      <span className="text-3xl font-mono font-bold text-yellow-400">{timeLeft}</span>
    </div>
  );
}
```

---

## Step 8 — Update `TypingArea.tsx`

Add new props matching the TimerBar changes, plus quote/custom mode UI.

New props to add to the `Props` interface:
```ts
gameMode: GameMode;
wordTarget: WordCountTarget | null;
wordsCompleted: number;
wordsTotal: number | null;       // fixedWords?.length for progress display
currentQuote: Quote | null;
customText: string;              // current textarea draft (idle only)
onChangeMode: (m: GameMode) => void;
onChangeWordTarget: (t: WordCountTarget) => void;
onChangeCustomText: (t: string) => void;
onStartCustom: () => void;
```

**Custom mode textarea (shown when `gameMode === 'custom' && testState === 'idle'`):**
```tsx
{gameMode === 'custom' && testState === 'idle' && (
  <div className="mb-6">
    <textarea
      className="w-full h-28 bg-gray-100 dark:bg-gray-900 rounded-lg p-3 text-sm font-mono
                 text-gray-700 dark:text-gray-300 resize-none border border-gray-300 dark:border-gray-700
                 focus:outline-none focus:border-yellow-400"
      placeholder="paste your text here, then press start..."
      value={customText}
      onChange={e => onChangeCustomText(e.target.value)}
    />
    <div className="flex justify-center mt-2">
      <button
        onClick={onStartCustom}
        disabled={customText.trim().split(/\s+/).length < 3}
        className="px-4 py-1.5 rounded bg-yellow-400 text-gray-900 text-sm font-medium
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        start
      </button>
    </div>
  </div>
)}
```

**Quote mode attribution (shown when `gameMode === 'quote' && testState === 'running'`):**
```tsx
{gameMode === 'quote' && currentQuote && (
  <p className="text-center text-xs text-gray-500 dark:text-gray-600 mb-3 font-mono">
    — {currentQuote.author}{currentQuote.source ? `, ${currentQuote.source}` : ''}
  </p>
)}
```

---

## Step 9 — Update `App.tsx`

Add state for the new mode controls and wire them to the engine:

```ts
const [gameMode, setGameMode] = useState<GameMode>('timed');
const [wordTarget, setWordTarget] = useState<WordCountTarget>(25);
const [customText, setCustomText] = useState('');
```

Add to the `useTypingEngine` destructure:
```ts
const { state, handleKeyDown, reset, changeDuration, startFocusedSession, endTest,
        startWordCountSession, startQuoteSession, startCustomSession } = useTypingEngine();
```

Wire `onChangeMode`:
```ts
const handleChangeMode = useCallback((m: GameMode) => {
  setGameMode(m);
  reset(); // reset engine back to idle
}, [reset]);

const handleChangeWordTarget = useCallback((t: WordCountTarget) => {
  setWordTarget(t);
  startWordCountSession(t);
}, [startWordCountSession]);

const handleStartCustom = useCallback(() => {
  startCustomSession(customText);
}, [startCustomSession, customText]);
```

For quote mode: add a `useEffect` or button that calls `startQuoteSession(randomQuote)` when the user clicks "new quote" or starts typing. Simplest approach: when `gameMode === 'quote'` and engine is `idle`, automatically call `startQuoteSession(pickRandom(QUOTES))` on mount and after each restart.

Pass all new props down through `TypingArea` and `TimerBar`.

---

## Step 10 — Update `ResultsScreen.tsx`

Show quote attribution when `results.quote` exists:

```tsx
{results.quote && (
  <div className="flex justify-center mb-4">
    <p className="text-xs text-gray-500 font-mono text-center">
      "{results.quote.text.slice(0, 60)}{results.quote.text.length > 60 ? '…' : ''}"
      <br />
      <span className="text-gray-600">— {results.quote.author}</span>
    </p>
  </div>
)}
```

Place this above the `StatsBar`.

---

## Verification

```bash
cd frontend && npx tsc --noEmit   # zero errors
npm run test                       # all existing tests pass
```

Manual smoke tests:
1. **timed**: select 15s, type, test ends at 0 — results show correctly
2. **words**: select 25, type 25 words — test ends, no timer shown
3. **quote**: tab to quote, quote loads, attribution shows during test and in results
4. **custom**: paste "the quick brown fox jumps over the lazy dog", press start, type it, test ends
5. Tab+Enter restarts from any mode
6. Focused practice sessions still work (they override gameMode internally)
