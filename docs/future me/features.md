# Adapta-Type — Feature List

Everything built in this project, in rough chronological order.

---

## Core Typing Engine

**Sliding 3-word window**
Only 3 words exist at a time. When you complete a word, it slides off, the next word moves up, and a new word is generated at the back. Words are never re-typed; the window keeps moving. This is different from MonkeyType's line-based approach.

**Per-character state tracking**
Each character is `untyped | correct | incorrect | extra`. Backspace resets characters. A word has "had an error" even if the error was backspaced and corrected — this is intentional (muscle memory: the wrong motion still happened).

**Duration modes**
- 15s / 30s / 60s / 120s — countdown timer, auto-finishes
- Infinite — counts up in yellow, user presses "end" button to finish

---

## Difficulty System

Auto-adjusting difficulty (levels 1–4) based on your performance within a test.

- **Levels** correspond to QWERTY ergonomic tiers: easy home-row words → harder extended-reach words
- Difficulty goes **up** after `N` consecutive perfect words (no errors even if backspaced), where `N` depends on duration (3 for 15s, 5 for 30–60s, 7 for 120s, 5 for infinite)
- Difficulty goes **down** after 3 consecutive error words
- Label shown top-right during test with flash animation: `easy / medium / hard / expert`
- Word pool: top 1500 most common English words, sorted by QWERTY difficulty score (key reach + same-finger penalty)

---

## N-Gram Detection (Error-Based)

The main adaptive feature. Tracks bigrams (2-char) and trigrams (3-char) on every keypress.

**Promotion thresholds:**
- `ERROR_MIN = 2` — needs at least 2 errors on a pattern
- `ERROR_RATE_MIN = 10%` — errors must be ≥10% of all encounters

When a pattern crosses both thresholds at word completion, it's **promoted** to the active focus set (`ngrams` map). The word generator then forces words containing that pattern.

**Graduation (streak system):**
- A pattern graduates after 3 consecutive correct encounters in the active focus set
- On graduation, removed from `ngrams`, added to `ngramGraduated`, cleared from `ngramStats` (can't re-promote immediately)

**Focusing on chips (during test):**
- Top 5 error-detected patterns shown above the word line as yellow chips with 3 pip dots showing streak progress
- Timing-seeded slow patterns are excluded from these chips (handled separately)

---

## N-Gram Detection (Timing-Based / Cross-Session)

For expert typists who rarely make errors. Measures inter-keystroke timing per bigram.

**How it works:**
- `performance.now()` delta captured on every keypress
- Deltas > 2000ms are ignored (pauses)
- Delta resets to null at each word boundary (space key)
- Accumulated per bigram in `ngramStats.totalMs` / `timedCount`
- At test end, persisted to `adapta-type-timing` in localStorage

**Slow pattern detection:**
- Requires `MIN_TIMING_SAMPLES = 3` timed keypresses for a bigram before comparing
- A pattern is "slow" if its average ms is ≥ `SLOW_MULTIPLIER (1.5×)` the overall session average
- Once flagged slow, stored permanently in `adapta-type-flagged-slow` (never disappears)
- Shows `improved: true` if current ratio < flagged ratio × 0.8 (i.e., 20%+ better)
- Slow patterns are pre-seeded into the active ngrams at test start (force practice without being shown in "focusing on" chips)

---

## Persistent Struggling Patterns (Error-Based, Cross-Session)

For patterns where the user consistently makes errors across runs.

**How it works:**
- At end of every test, any bigram/trigram with `errors > 0` is saved to `adapta-type-struggling` in localStorage
- Stores: original error rate when first flagged, practice session count
- Streak-graduated patterns are removed from the struggling map immediately

**Auto-graduation:**
- After 3 focused practice sessions for a pattern (`markPatternPracticed` called on `startFocusedSession`)
- If current error rate < original flagged rate ÷ 1.5 (i.e., 33%+ improvement), pattern is removed
- This fires at the END of any run where the pattern appears in `ngramStats`

---

## Results Screen

Shown after every test (timed or infinite).

**Stats row:** WPM, raw WPM, accuracy, duration

**Extra stats row:** peak WPM, best perfect-word streak, cleared count

**WPM graph:** Line chart showing WPM over time, with difficulty change markers overlaid

**Pattern breakdown (the "pattern wall" in results):**
- `consistently slow` — yellow chips, timing-based (from `getSlowPatterns()`)
- `still struggling` — red chips, error-based (from `loadStrugglingPatterns()`, persistent across sessions)
- `cleared` — green chips, streak-graduated during this run
- All chips are clickable → expand to show duration picker (15s / 30s / 60s / 120s) → launches focused practice session

**Focused session banner:** If you completed a focused practice session, the results screen shows "practiced [pattern]" at the top.

**Session count gating:** The timing profile section shows an empty state until 3 sessions complete.

---

## Pattern Wall (Full View)

Accessible via header toggle. Persistent across all sessions.

Shows all patterns ever detected, split into:
- **Needs practice** (red cards) — patterns with errors that haven't been mastered
- **Mastered** (green cards) — patterns completed via focused session

Each card shows: pattern text, best WPM, best accuracy, session count. Click to open practice duration picker.

---

## Sound

Web Audio API (no files). Stored in `adapta-type-sound` localStorage.

- Correct keypress: 800Hz sine wave, 80ms
- Wrong keypress: 220Hz sine wave, 80ms
- Toggle in header (speaker icon)

---

## Other UX Details

- **Caps lock warning** — yellow text above words if caps lock is on
- **Tab + Enter** — restart from anywhere (global keyboard shortcut)
- **"end" button** — infinite mode only, finishes the test
- **Live WPM/accuracy** — shown during running test
- **Hint** — first line shows character-by-character hint until the first word is completed
