# Codebase Map

Every source file and what it does.

---

## `frontend/src/`

### `App.tsx`
Top-level component. Owns the view switcher (`typing | wall`), wires all hooks together, handles the Tab+Enter global shortcut, and passes callbacks down. The `prevTestStateRef` pattern catches the `idle → running → finished` transition to trigger `addFromSession` and `markCompleted` exactly once per test.

### `types/index.ts`
All shared TypeScript types:
- `CharState` — per-character render state
- `WpmDataPoint` — `{ t, wpm, raw, errors }` — one point per second in the graph
- `DifficultyChange` — `{ t, level }` — when difficulty changed during a test
- `TestResults` — everything the results screen needs
- `TestState` — `'idle' | 'running' | 'finished'`
- `TimedMode` — `15 | 30 | 60 | 120 | 'infinite'`

---

## `hooks/`

### `useTypingEngine.ts`
The entire game loop. This is the biggest and most important file.

**State shape (`EngineState`):**
- `testState`, `duration`, `timeLeft`
- `line: { words, charStates }` — the 3-word sliding window
- `currentWord`, `currentChar`
- `ngrams` — active focus patterns (weight map)
- `slowNgramKeys` — timing-seeded patterns (for filtering "focusing on" chips)
- `ngramStreaks` — per-pattern streak counters
- `ngramGraduated` — patterns cleared this run
- `ngramStats` — per-keystroke bigram/trigram tally
- `focusedPattern` — set during focused practice sessions
- `difficultyLevel` (1–4), `difficultyHistory`
- `showLineHint`, `perfectWordStreak`, `longestPerfectStreak`, `errorWordStreak`, `currentWordHadError`
- `correctChars`, `totalChars`, `errorCount`
- `wpmHistory`, `results`

**Key functions:**
- `buildInitialState(duration)` — seeds slow patterns from localStorage
- `handleKeyDown` — entire typing logic in one setState call (backspace, space/word-advance, character)
- `updateStreaks(...)` — pure function, called in handleKeyDown on word completion
- `finishTest(s)` — computes results, saves timing + struggling to localStorage, fires backend POST
- `startFocusedSession(pattern, duration)` — marks pattern practiced, sets up focused game state
- `endTest()` — for infinite mode "end" button

**Refs:** `stateRef` (latest state for interval callbacks), `lastKeypressTimeRef` (timing), `storedTimingRef`, `tickerRef`, `startTimeRef`, `secondCountRef`

### `usePatternLibrary.ts`
Manages the persistent pattern wall library (`adapta-type-patterns` in localStorage).

- `addFromSession(mistakes, graduated)` — called on test finish, accumulates total errors
- `markCompleted(pattern)` — called when a focused session finishes
- `recordFocusedSession(pattern, wpm, accuracy)` — tracks best stats per pattern

### `useSound.ts`
Web Audio API. Creates oscillator nodes on each play call (no AudioBuffer needed).
- `playCorrect()` — 800Hz, 80ms
- `playWrong()` — 220Hz, 80ms
- Toggle persisted to `adapta-type-sound`

---

## `lib/`

### `ngramTracker.ts`
All n-gram intelligence. No React, pure TypeScript.

Exports:
- `updateNgramStats(word, charIndex, isCorrect, stats, deltaMs)` — per-keypress tracker
- `promoteNgrams(word, stats, currentNgrams, graduated)` — word-completion promoter
- `saveTimingToStorage(stats)` — persist timing to localStorage
- `loadStoredTiming()` — read timing from localStorage
- `getSessionCount()` / `incrementSessionCount()` — session counter
- `getSlowPatterns()` → `SlowPattern[]` — compute slow patterns from timing data
- `updateStrugglingPatterns(ngramStats, ngramGraduated)` — persist error patterns
- `loadStrugglingPatterns()` → `StrugglingMap` — read struggling patterns
- `markPatternPracticed(pattern)` — increment practice count for a pattern
- `ERROR_MIN`, `ERROR_RATE_MIN` — exported constants

### `wordSelector.ts`
Word generation logic.

- `WORD_LIST` — top 1500 common words (from `data/wordlist.ts`)
- `DIFFICULTY_TIERS[4]` — words sorted by QWERTY difficulty score (key reach + same-finger penalty), split into 4 tiers (30/30/20/20%)
- `generateWord(ngrams, difficulty, exclude)` — picks a random word from the tier pool that contains at least one active n-gram
- `generateLine(ngrams, count, difficulty)` — generates N words, cycling shuffled practice pool
- `hasSufficientCoverage(pattern)` — checks if ≥5 words in the full list contain this pattern (filters spurious promotions)
- `getProactiveBigrams(count)` — computes same-finger bigrams by frequency (currently unused in the main flow but available)

### `statsCalculator.ts`
Pure math functions.
- `calcWpm(correctChars, elapsedMs)` — standard WPM formula (chars / 5 / minutes)
- `calcRawWpm(totalChars, elapsedMs)` — no accuracy penalty
- `calcAccuracy(correctChars, totalChars)` — percentage, 0–100

---

## `components/TypingTest/`

### `TypingArea.tsx`
The main typing UI. Owns:
- Hidden `<input>` that captures keyboard events (keeps focus management simple)
- Sound-aware `handleKeyWithSound` wrapper
- Caps lock detection
- Difficulty flash animation trigger
- Live WPM/accuracy display (during `running`)
- "Focusing on" chips with 3-pip streak indicator (yellow, excludes slow patterns)
- `WordDisplay` with `showHint` prop
- "end" button (infinite mode) + "restart" button

### `WordDisplay.tsx`
Renders the 3-word window. Each character gets a color based on its `CharState`. The active word has a cursor. First-line hint shown as faint overlay until first word is completed.

### `TimerBar.tsx`
Shows duration mode buttons (15/30/60/120/∞) and the progress bar. During a running test the whole bar turns yellow regardless of mode.

---

## `components/Results/`

### `ResultsScreen.tsx`
Post-test breakdown. Reads from:
- `results` prop — current test data
- `getSlowPatterns()` — live localStorage read
- `loadStrugglingPatterns()` — live localStorage read

Pattern breakdown section shows three groups (consistently slow / still struggling / cleared), all clickable for practice. Uses `pickingPattern` state to show the inline duration picker.

### `StatsBar.tsx`
Top stats row: WPM, raw WPM, accuracy, duration.

### `WpmGraph.tsx`
SVG line chart of WPM over time. Overlays difficulty change markers as vertical dashed lines.

---

## `components/PatternWall/`

### `PatternWall.tsx`
Full-screen pattern library view. Two columns: "needs practice" (red cards) | "mastered" (green cards). Each card expands on click to show stats + duration picker. Sorted by total errors descending.

---

## `components/Layout/`

### `Header.tsx`
Logo, view toggle button (typing ↔ wall), sound toggle. All navigation lives here.

---

## `data/wordlist.ts`
A large array of the most common English words, frequency-ordered. The `wordSelector.ts` only uses the first 1500 for gameplay; the full list is available for pattern coverage fallback.
