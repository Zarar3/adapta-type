import { useCallback, useEffect, useRef, useState } from 'react';
import { generateLine, generateWord, generateWordContaining, hasSufficientCoverage } from '../lib/wordSelector';
import { updateNgramStats, promoteNgrams, saveTimingToStorage, loadStoredTiming, getSlowPatterns, getFlaggedSlowKeys, incrementSessionCount, updateStrugglingPatterns, markPatternPracticed, saveActiveNgrams, loadActiveNgrams, clearActiveNgrams } from '../lib/ngramTracker';
import type { NgramStats, StoredTiming } from '../lib/ngramTracker';
import { calcWpm, calcRawWpm, calcAccuracy } from '../lib/statsCalculator';
import type { CharState, TestState, TimedMode, WpmDataPoint, TestResults, DifficultyChange, GameMode, WordCountTarget, Quote } from '../types';

function streakThreshold(duration: TimedMode): number {
  if (duration === 'infinite') return 5;
  if (duration <= 15) return 3;
  if (duration <= 60) return 5;
  return 7; // 120s
}

interface LineData {
  words: string[];
  charStates: CharState[][];
}

interface EngineState {
  testState: TestState;
  duration: TimedMode;
  gameMode: GameMode;
  wordTarget: WordCountTarget | null;
  wordsCompleted: number;
  fixedWords: string[] | null;
  fixedWordOffset: number;
  currentQuote: Quote | null;
  timeLeft: number;
  // Only the active line is held in state; the next line is generated on completion
  line: LineData;
  currentWord: number;
  currentChar: number;
  ngrams: Record<string, number>;
  slowNgramKeys: Record<string, true>;    // ngrams seeded from cross-session timing data
  ngramStreaks: Record<string, number>;   // consecutive correct encounters per n-gram
  ngramGraduated: Record<string, number>; // patterns cleared during this test
  ngramAges: Record<string, number>;      // words typed since each ngram was promoted
  ngramCoverageIdx: number;               // round-robin index into ngramDisplayOrder
  ngramStats: NgramStats;                 // per-keystroke bigram/trigram accuracy tally
  ngramDisplayOrder: string[];            // up to 5 error-detected patterns currently shown in chips
  ngramWaitQueue: string[];               // promoted but waiting for a display slot
  recentWords: string[];                  // last N completed words, used to avoid repeats
  focusedPattern: string | null;          // set during a single-pattern practice session
  difficultyLevel: number;                // 1–4, increases as user improves
  difficultyHistory: DifficultyChange[];  // when difficulty changed during the test
  showLineHint: boolean;                  // true until the first line is completed
  perfectWordStreak: number;              // consecutive fully-correct words
  longestPerfectStreak: number;           // peak streak achieved during this test
  errorWordStreak: number;               // consecutive words with any mistake (for difficulty down)
  currentWordHadError: boolean;           // any wrong key this word, even if backspaced
  correctChars: number;
  totalChars: number;
  errorCount: number;
  wpmHistory: WpmDataPoint[];
  results: TestResults | null;
}

function makeLineData(words: string[]): LineData {
  return {
    words,
    charStates: words.map(w => Array(w.length).fill('untyped') as CharState[]),
  };
}

/** On word completion, update per-n-gram streaks. Graduates an n-gram at streak 3. */
function updateStreaks(
  word: string,
  wordCharStates: CharState[],
  ngrams: Record<string, number>,
  streaks: Record<string, number>,
  graduated: Record<string, number>,
  ngramStats: NgramStats,
): { ngrams: Record<string, number>; ngramStreaks: Record<string, number>; ngramGraduated: Record<string, number>; ngramStats: NgramStats } {
  const newNgrams = { ...ngrams };
  const newStreaks = { ...streaks };
  const newGraduated = { ...graduated };
  const newStats = { ...ngramStats };

  for (const ng of Object.keys(newNgrams)) {
    if (ng.length > word.length) continue;

    // Find the first occurrence of this n-gram in the word and check ONLY those chars
    let found = false;
    let allCorrect = true;

    for (let pos = 0; pos <= word.length - ng.length; pos++) {
      if (word.slice(pos, pos + ng.length) === ng) {
        found = true;
        // Check just the chars belonging to this specific occurrence
        for (let ci = pos; ci < pos + ng.length; ci++) {
          if (wordCharStates[ci] !== 'correct') { allCorrect = false; }
        }
        break; // only check the first occurrence — each n-gram judged independently
      }
    }

    if (!found) continue;

    if (allCorrect) {
      const streak = (newStreaks[ng] ?? 0) + 1;
      if (streak >= 3) {
        newGraduated[ng] = (newGraduated[ng] ?? 0) + 1;
        delete newNgrams[ng];
        delete newStreaks[ng];
        delete newStats[ng]; // clear from stats so it can't be re-promoted
      } else {
        newStreaks[ng] = streak;
      }
    } else {
      // Only this n-gram's streak resets — others are unaffected
      newStreaks[ng] = 0;
    }
  }

  return { ngrams: newNgrams, ngramStreaks: newStreaks, ngramGraduated: newGraduated, ngramStats: newStats };
}

interface ModeOpts {
  wordTarget?: WordCountTarget;
  fixedWords?: string[];
  quote?: Quote;
}

function buildInitialState(
  duration: TimedMode,
  gameMode: GameMode = 'timed',
  opts: ModeOpts = {},
): EngineState {
  const slowPatterns = getSlowPatterns();
  const slowNgrams = Object.fromEntries(slowPatterns.map(p => [p.ng, 1]));
  const slowNgramKeys = Object.fromEntries(slowPatterns.map(p => [p.ng, true as const]));
  const persistedNgrams = loadActiveNgrams();
  const mergedNgrams = { ...persistedNgrams, ...slowNgrams };
  const allNgramKeys = Object.keys(mergedNgrams);
  const initialDisplay = allNgramKeys.slice(0, 5);
  const initialQueue = allNgramKeys.slice(5);
  const displayNgramsForLine = Object.fromEntries(initialDisplay.map(ng => [ng, mergedNgrams[ng]]));
  return {
    testState: 'idle',
    duration,
    gameMode,
    wordTarget: opts.wordTarget ?? null,
    wordsCompleted: 0,
    fixedWords: opts.fixedWords ?? null,
    fixedWordOffset: 0,
    currentQuote: opts.quote ?? null,
    timeLeft: duration === 'infinite' ? 0 : duration,
    line: opts.fixedWords
      ? makeLineData(opts.fixedWords.slice(0, 3))
      : makeLineData(generateLine(displayNgramsForLine, 3, 1)),
    currentWord: 0,
    currentChar: 0,
    ngrams: mergedNgrams,
    slowNgramKeys,
    ngramStreaks: {},
    ngramGraduated: {},
    ngramAges: {},
    ngramCoverageIdx: 0,
    ngramStats: {},
    ngramDisplayOrder: initialDisplay,
    ngramWaitQueue: initialQueue,
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

export function useTypingEngine() {
  const [duration, setDuration] = useState<TimedMode>(30);
  const [state, setState] = useState<EngineState>(() => buildInitialState(30));

  const startTimeRef = useRef<number | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondCountRef = useRef(0);
  const lastKeypressTimeRef = useRef<number | null>(null);
  const storedTimingRef = useRef<StoredTiming>(loadStoredTiming());

  // Expose a stable ref to the latest state for use inside intervals
  const stateRef = useRef(state);
  stateRef.current = state;

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const finishTest = useCallback((s: EngineState) => {
    stopTicker();
    const elapsedMs = s.duration === 'infinite' ? s.timeLeft * 1000 : (s.duration as number) * 1000;
    const wpm = calcWpm(s.correctChars, elapsedMs);
    const rawWpm = calcRawWpm(s.totalChars, elapsedMs);
    const accuracy = calcAccuracy(s.correctChars, s.totalChars);
    const peakWpm = s.wpmHistory.length > 0 ? Math.max(...s.wpmHistory.map(p => p.wpm)) : 0;
    // Capture which patterns were already flagged slow BEFORE merging this run's timing
    const preRunSlowKeys = getFlaggedSlowKeys();

    const results: TestResults = {
      wpm, rawWpm, accuracy,
      duration: s.duration === 'infinite' ? s.timeLeft : s.duration,
      peakWpm,
      longestPerfectStreak: s.longestPerfectStreak,
      wpmHistory: s.wpmHistory,
      ngramMistakes: Object.fromEntries(
        Object.entries(s.ngramStats)
          .filter(([, stat]) => stat.errors > 0)
          .map(([ng, stat]) => [ng, stat.errors])
      ),
      ngramFocused: Object.keys(s.ngrams).filter(ng => !s.slowNgramKeys[ng]),
      preRunSlowKeys,
      ngramGraduated: s.ngramGraduated,
      difficultyHistory: s.difficultyHistory,
      quote: s.currentQuote ?? undefined,
    };

    // Persist per-bigram timing and struggling patterns to localStorage
    saveTimingToStorage(s.ngramStats);
    updateStrugglingPatterns(s.ngramStats, s.ngramGraduated);
    saveActiveNgrams(s.ngrams);
    incrementSessionCount();
    storedTimingRef.current = loadStoredTiming();

    // Fire-and-forget POST to backend
    const backendUrl = import.meta.env.VITE_BACKEND_URL as string;
    fetch(`${backendUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration: s.duration,
        wpm, raw_wpm: rawWpm, accuracy,
        wpm_history: s.wpmHistory.map(p => ({ t: p.t, wpm: p.wpm, raw: p.raw, errors: p.errors })),
        ngram_mistakes: s.ngrams,
      }),
    }).catch(() => { /* non-fatal */ });

    setState(prev => ({ ...prev, testState: 'finished', results }));
  }, [stopTicker]);

  const startTicker = useCallback((initialState: EngineState) => {
    secondCountRef.current = 0;
    startTimeRef.current = Date.now();

    tickerRef.current = setInterval(() => {
      const s = stateRef.current;
      secondCountRef.current += 1;
      const elapsed = secondCountRef.current * 1000;
      const wpm = calcWpm(s.correctChars, elapsed);
      const rawWpm = calcRawWpm(s.totalChars, elapsed);

      const newPoint: WpmDataPoint = {
        t: secondCountRef.current,
        wpm,
        raw: rawWpm,
        errors: s.errorCount,
      };

      if (s.duration === 'infinite') {
        // Count up; never auto-finish
        setState(prev => ({
          ...prev,
          timeLeft: secondCountRef.current,
          wpmHistory: [...prev.wpmHistory, newPoint],
        }));
      } else {
        const timeLeft = (s.duration as number) - secondCountRef.current;
        if (timeLeft <= 0) {
          setState(prev => ({
            ...prev,
            timeLeft: 0,
            wpmHistory: [...prev.wpmHistory, newPoint],
          }));
          // Finish is called via effect watching timeLeft
        } else {
          setState(prev => ({
            ...prev,
            timeLeft,
            wpmHistory: [...prev.wpmHistory, newPoint],
          }));
        }
      }
    }, 1000);

    void initialState;
  }, []);

  // Watch for timeLeft hitting 0 (not applicable to infinite mode)
  useEffect(() => {
    if (state.testState === 'running' && state.timeLeft <= 0 && state.duration !== 'infinite') {
      finishTest(stateRef.current);
    }
  }, [state.timeLeft, state.testState, state.duration, finishTest]);

  // Watch for word-count mode completion
  useEffect(() => {
    if (state.gameMode === 'words' && state.wordsCompleted >= (state.wordTarget ?? Infinity) && state.testState === 'running') {
      finishTest(stateRef.current);
    }
  }, [state.wordsCompleted, state.gameMode, state.wordTarget, state.testState, finishTest]);

  // Watch for fixed-text mode completion (quote/custom)
  useEffect(() => {
    if (state.fixedWords && state.fixedWordOffset + 2 >= state.fixedWords.length && state.testState === 'running' && state.wordsCompleted > 0) {
      finishTest(stateRef.current);
    }
  }, [state.fixedWordOffset, state.fixedWords, state.testState, state.wordsCompleted, finishTest]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore modifier keys and function keys
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length > 1 && e.key !== 'Backspace' && e.key !== ' ') return;

    // Capture inter-keystroke delta for timing analysis
    const now = performance.now();
    const deltaMs = lastKeypressTimeRef.current !== null ? now - lastKeypressTimeRef.current : null;
    lastKeypressTimeRef.current = now;
    const validDelta = deltaMs !== null && deltaMs < 2000 ? deltaMs : null;

    setState(prev => {
      if (prev.testState === 'finished') return prev;

      let next = { ...prev };

      // Start timer on first keystroke
      if (prev.testState === 'idle') {
        next = { ...next, testState: 'running' };
        // startTicker is called after setState via effect below
      }

      const { line, currentWord, currentChar } = next;
      const word = line.words[currentWord];

      if (e.key === 'Backspace') {
        if (currentChar > 0) {
          const newCharStates = line.charStates.map(row => [...row]);
          newCharStates[currentWord][currentChar - 1] = 'untyped';
          return { ...next, line: { ...line, charStates: newCharStates }, currentChar: currentChar - 1 };
        }
        return next;
      }

      if (e.key === ' ' && currentChar === word.length) {
        // Reset timing ref between words to avoid measuring pause time
        lastKeypressTimeRef.current = null;
        const wordStates = line.charStates[currentWord];
        const hadError = next.currentWordHadError;

        // Perfect streak: any wrong key (even corrected) breaks it
        const perfect = !hadError;
        const newStreak = perfect ? next.perfectWordStreak + 1 : 0;

        // Error streak: consecutive words with any mistake → drop difficulty after 3
        const newErrorStreak = hadError ? next.errorWordStreak + 1 : 0;

        let newDifficulty = next.difficultyLevel;
        let adjustedStreak = newStreak;
        let adjustedErrorStreak = newErrorStreak;
        if (newStreak >= streakThreshold(next.duration) && newDifficulty < 4) { newDifficulty += 1; adjustedStreak = 0; adjustedErrorStreak = 0; }
        if (newErrorStreak >= 3 && newDifficulty > 1) { newDifficulty -= 1; adjustedErrorStreak = 0; adjustedStreak = 0; }

        const promoted = promoteNgrams(word, next.ngramStats, next.ngrams, next.ngramGraduated);
        const ngramsAfterPromotion = Object.fromEntries(
          Object.entries(promoted).filter(([ng]) => hasSufficientCoverage(ng))
        );

        let displayOrder = [...next.ngramDisplayOrder];
        let waitQueue = [...next.ngramWaitQueue];

        // Only track streaks for patterns in active display slots; queue patterns wait silently
        const displaySlotNgrams = Object.fromEntries(
          Object.entries(ngramsAfterPromotion).filter(([ng]) => displayOrder.includes(ng))
        );
        const queueOnlyNgrams = Object.fromEntries(
          Object.entries(ngramsAfterPromotion).filter(([ng]) => !displayOrder.includes(ng))
        );
        const { ngrams: updatedDisplayNgrams, ngramStreaks: updatedStreaks, ngramGraduated: updatedGraduated, ngramStats: updatedStats } =
          updateStreaks(word, wordStates, displaySlotNgrams, next.ngramStreaks, next.ngramGraduated, next.ngramStats);
        const updatedNgrams = { ...queueOnlyNgrams, ...updatedDisplayNgrams };

        const elapsedT = next.duration === 'infinite'
          ? next.timeLeft
          : (next.duration as number) - next.timeLeft;
        const updatedDifficultyHistory = newDifficulty !== next.difficultyLevel
          ? [...next.difficultyHistory, { t: elapsedT, level: newDifficulty }]
          : next.difficultyHistory;

        // Patterns newly promoted this word (not slow timing patterns)
        const newlyPromoted = Object.keys(ngramsAfterPromotion)
          .filter(ng => !(ng in next.ngrams) && !next.slowNgramKeys[ng]);
        // Patterns that graduated this word (were in active ngrams, now removed)
        const justGraduated = new Set(
          Object.keys(ngramsAfterPromotion).filter(ng => !(ng in updatedNgrams))
        );

        // Free slots when patterns graduate; pull from wait queue to fill them
        for (const ng of justGraduated) {
          const dIdx = displayOrder.indexOf(ng);
          const qIdx = waitQueue.indexOf(ng);
          if (dIdx !== -1) {
            displayOrder.splice(dIdx, 1);
            if (waitQueue.length > 0) displayOrder.push(waitQueue.shift()!);
          } else if (qIdx !== -1) {
            waitQueue.splice(qIdx, 1);
          }
        }

        // Add newly promoted to display (up to 5) or wait queue
        for (const ng of newlyPromoted) {
          if (justGraduated.has(ng)) continue;
          if (displayOrder.length < 5) {
            displayOrder.push(ng);
          } else {
            waitQueue.push(ng);
          }
        }

        // N-gram weight decay — silently expire patterns idle for too long
        const DECAY_THRESHOLD = 40;
        const updatedAges: Record<string, number> = {};
        for (const ng of Object.keys(updatedNgrams)) {
          updatedAges[ng] = (next.ngramAges[ng] ?? 0) + 1;
        }
        for (const ng of newlyPromoted) {
          updatedAges[ng] = 0;
        }
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
            const dIdx = displayOrder.indexOf(ng);
            if (dIdx !== -1) {
              displayOrder.splice(dIdx, 1);
              if (waitQueue.length > 0) displayOrder.push(waitQueue.shift()!);
            }
            const qIdx = waitQueue.indexOf(ng);
            if (qIdx !== -1) waitQueue.splice(qIdx, 1);
          }
        }
        for (const ng of agedOutNgrams) {
          delete updatedNgrams[ng];
          delete updatedStreaks[ng];
        }

        const updatedRecent = [...next.recentWords, word].slice(-3);

        const shared = {
          ngrams: updatedNgrams,
          ngramStreaks: updatedStreaks,
          ngramGraduated: updatedGraduated,
          ngramAges: updatedAges,
          ngramStats: updatedStats,
          ngramDisplayOrder: displayOrder,
          ngramWaitQueue: waitQueue,
          recentWords: updatedRecent,
          difficultyLevel: newDifficulty,
          difficultyHistory: updatedDifficultyHistory,
          perfectWordStreak: adjustedStreak,
          longestPerfectStreak: Math.max(next.longestPerfectStreak, newStreak),
          errorWordStreak: adjustedErrorStreak,
          currentWordHadError: false,
          wordsCompleted: next.wordsCompleted + 1,
        };

        // Word-count mode: finish when target reached
        if (next.gameMode === 'words' && next.wordsCompleted + 1 >= (next.wordTarget ?? Infinity)) {
          return { ...next, ...shared };
        }

        // Fixed-word modes (quote/custom): advance window or finish
        if (next.fixedWords) {
          const nextOffset = next.fixedWordOffset + 1;
          if (nextOffset + 2 >= next.fixedWords.length) {
            return { ...next, ...shared, fixedWordOffset: nextOffset };
          }
          const fwWords = next.fixedWords.slice(nextOffset, nextOffset + 3);
          return {
            ...next,
            ...shared,
            fixedWordOffset: nextOffset,
            showLineHint: false,
            line: { words: fwWords, charStates: fwWords.map(w => Array(w.length).fill('untyped') as CharState[]) },
            currentWord: 0,
            currentChar: 0,
          };
        }

        // Regenerate stale queued words when patterns were newly promoted this word
        let w1 = line.words[1];
        let w2 = line.words[2];
        if (newlyPromoted.length > 0 && displayOrder.length > 0) {
          const hasActivePattern = (w: string) => displayOrder.some(ng => w.includes(ng));
          let ci = next.ngramCoverageIdx;
          if (!hasActivePattern(w1)) {
            const excl = [...new Set([...updatedRecent, line.words[0]])];
            w1 = generateWordContaining(displayOrder[ci % displayOrder.length], newDifficulty, excl);
            if (displayOrder.length > 1) ci = (ci + 1) % displayOrder.length;
          }
          if (!hasActivePattern(w2)) {
            const excl = [...new Set([...updatedRecent, line.words[0], w1])];
            w2 = generateWordContaining(displayOrder[ci % displayOrder.length], newDifficulty, excl);
          }
        }

        // Generate next word with round-robin pattern targeting
        const excludeList = [...new Set([...updatedRecent, w1, w2])];
        let nextCoverageIdx = next.ngramCoverageIdx;
        let nextWord: string;
        if (next.focusedPattern) {
          nextWord = generateWordContaining(next.focusedPattern, newDifficulty, excludeList);
        } else if (displayOrder.length > 0) {
          nextWord = generateWordContaining(
            displayOrder[nextCoverageIdx % displayOrder.length],
            newDifficulty,
            excludeList,
          );
          nextCoverageIdx = (nextCoverageIdx + 1) % displayOrder.length;
        } else {
          const activeNgrams = Object.fromEntries(
            Object.entries(updatedNgrams).filter(([ng]) => displayOrder.includes(ng))
          );
          nextWord = generateWord(
            Object.keys(activeNgrams).length > 0 ? activeNgrams : updatedNgrams,
            newDifficulty,
            excludeList,
            0.9,
          );
        }

        const newWords = [w1, w2, nextWord];
        return {
          ...next,
          ...shared,
          ngramCoverageIdx: nextCoverageIdx,
          showLineHint: false,
          line: {
            words: newWords,
            charStates: newWords.map(w => Array(w.length).fill('untyped') as CharState[]),
          },
          currentWord: 0,
          currentChar: 0,
        };
      }

      // Regular character — only accept up to word length, never auto-advance word
      if (currentChar >= word.length) return next;

      const expected = word[currentChar];
      const isCorrect = e.key === expected;

      const newCharStates = line.charStates.map(row => [...row]);
      newCharStates[currentWord][currentChar] = isCorrect ? 'correct' : 'incorrect';

      // Accumulate bigram/trigram stats on every keypress (including backspaced errors)
      const newNgramStats = updateNgramStats(word, currentChar, isCorrect, next.ngramStats, validDelta);

      return {
        ...next,
        line: { ...line, charStates: newCharStates },
        currentChar: currentChar + 1,
        correctChars: next.correctChars + (isCorrect ? 1 : 0),
        totalChars: next.totalChars + 1,
        errorCount: next.errorCount + (isCorrect ? 0 : 1),
        currentWordHadError: next.currentWordHadError || !isCorrect,
        ngramStats: newNgramStats,
      };
    });
  }, []);

  // Start ticker when test transitions to running
  useEffect(() => {
    if (state.testState === 'running' && !tickerRef.current) {
      startTicker(state);
    }
  }, [state.testState, startTicker, state]);

  const reset = useCallback(() => {
    stopTicker();
    clearActiveNgrams();
    secondCountRef.current = 0;
    startTimeRef.current = null;
    setState(buildInitialState(duration));
  }, [duration, stopTicker]);

  const changeDuration = useCallback((d: TimedMode) => {
    stopTicker();
    clearActiveNgrams();
    setDuration(d);
    setState(buildInitialState(d));
  }, [stopTicker]);

  const startFocusedSession = useCallback((pattern: string, dur: TimedMode) => {
    stopTicker();
    secondCountRef.current = 0;
    startTimeRef.current = null;
    markPatternPracticed(pattern);
    const focusNgrams = { [pattern]: 5 };
    setDuration(dur);
    setState({
      ...buildInitialState(dur),
      focusedPattern: pattern,
      ngrams: focusNgrams,
      line: makeLineData(generateLine(focusNgrams, 3)),
    });
  }, [stopTicker]);

  const startWordCountSession = useCallback((target: WordCountTarget) => {
    stopTicker();
    secondCountRef.current = 0;
    startTimeRef.current = null;
    const dur: TimedMode = 'infinite';
    setDuration(dur);
    setState(buildInitialState(dur, 'words', { wordTarget: target }));
  }, [stopTicker]);

  const startQuoteSession = useCallback((quote: Quote) => {
    stopTicker();
    secondCountRef.current = 0;
    startTimeRef.current = null;
    const words = quote.text.split(/\s+/).filter(Boolean);
    setDuration('infinite');
    setState(buildInitialState('infinite', 'quote', { fixedWords: words, quote }));
  }, [stopTicker]);

  const startCustomSession = useCallback((text: string) => {
    stopTicker();
    secondCountRef.current = 0;
    startTimeRef.current = null;
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 3) return;
    setDuration('infinite');
    setState(buildInitialState('infinite', 'custom', { fixedWords: words }));
  }, [stopTicker]);

  // Cleanup on unmount
  useEffect(() => () => stopTicker(), [stopTicker]);

  const endTest = useCallback(() => {
    if (stateRef.current.testState === 'running') {
      finishTest(stateRef.current);
    }
  }, [finishTest]);

  return {
    state,
    handleKeyDown,
    reset,
    changeDuration,
    startFocusedSession,
    startWordCountSession,
    startQuoteSession,
    startCustomSession,
    endTest,
  };
}
