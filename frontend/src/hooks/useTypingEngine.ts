import { useCallback, useEffect, useRef, useState } from 'react';
import { generateLine, generateWord, generateWordContaining, hasSufficientCoverage } from '../lib/wordSelector';
import { updateNgramStats, promoteNgrams, saveTimingToStorage, loadStoredTiming, getSlowPatterns, getFlaggedSlowKeys, incrementSessionCount, updateStrugglingPatterns, markPatternPracticed, saveActiveNgrams, loadActiveNgrams, clearActiveNgrams, loadSurviveBest, saveSurviveBest, saveFocusCarryover, loadFocusCarryover } from '../lib/ngramTracker';
import type { NgramStats, StoredTiming } from '../lib/ngramTracker';
import { calcWpm, calcRawWpm, calcAccuracy } from '../lib/statsCalculator';
import { accuracyScoreMult, wpmScoreMult, difficultyScoreMult } from '../lib/surviveScoring';
import type { CharState, TestState, TimedMode, WpmDataPoint, TestResults, DifficultyChange, GameMode, Quote, WordCountTarget } from '../types';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleInitialSurviveOffsets(): { golden: number; freeze: number; bomb: number } {
  // Staggered base slots — shuffled so any type can appear first
  const bases = [2, 4, 7];
  for (let i = bases.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bases[i], bases[j]] = [bases[j], bases[i]];
  }
  return {
    golden: bases[0] + Math.floor(Math.random() * 2),
    freeze: bases[1] + Math.floor(Math.random() * 2),
    bomb:   bases[2] + Math.floor(Math.random() * 2),
  };
}

// Reschedule a consumed special word. ~35% of the time it snaps onto another
// type's pending future target, producing a combo word (gold/freeze, bomb/freeze,
// gold/bomb, or all three) instead of always spawning a fresh standalone special.
function rescheduleSpecial(newWc: number, baseMin: number, jitter: number, others: number[]): number {
  const futureOthers = others.filter(o => o > newWc + 1);
  if (futureOthers.length > 0 && Math.random() < 0.35) {
    return futureOthers[Math.floor(Math.random() * futureOthers.length)];
  }
  return newWc + baseMin + Math.floor(Math.random() * jitter);
}

// How many patterns can occupy chip slots at once. The rest wait silently in the queue
// and rotate in as slots free up — more than a few on screen is noise, not feedback.
const MAX_DISPLAY_PATTERNS = 3;

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
  wordTarget: number | null;
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
  ngramDisplayOrder: string[];            // up to MAX_DISPLAY_PATTERNS error-detected patterns shown in chips
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
  spaceBlocked: boolean;
  // Survive mode fields (zero/false/null in all other modes)
  surviveScore: number;
  survivePerfectCombo: number;
  surviveComboMultiplier: number;
  surviveGoldenMode: boolean;
  surviveGoldenTimeLeft: number;
  surviveGoldenCount: number;
  surviveMaxCombo: number;
  surviveNextGoldenWord: number;
  surviveBombActive: boolean;
  surviveBombCountdown: number;
  surviveNextBombWord: number;
  surviveNextFreezeWord: number;
  surviveFreezeLeft: number;          // seconds the survival countdown is frozen (freeze word reward)
  surviveFreezeBuffer: number;        // net time changes earned while frozen, applied on thaw
  survivePenaltyAppliedThisWord: boolean;
  surviveLastWordScore: { value: number; golden: boolean; id: number } | null;
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
  wordTarget?: number;
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

  // Carry forward patterns left unfinished at the end of the last session, even
  // if the timing data no longer flags them — they persist until graduated.
  const carryover = loadFocusCarryover();
  for (const ng of carryover) if (!(ng in mergedNgrams)) mergedNgrams[ng] = 1;

  // Unfinished carryover leads the visible set; everything else is shuffled so
  // the focus chips (and the refill queue) are a varying random sample.
  const carryInPool = carryover.filter(ng => ng in mergedNgrams);
  const rest = shuffleArray(Object.keys(mergedNgrams).filter(ng => !carryInPool.includes(ng)));
  const ordered = [...carryInPool, ...rest];
  const initialDisplay = ordered.slice(0, MAX_DISPLAY_PATTERNS);
  const initialQueue = ordered.slice(MAX_DISPLAY_PATTERNS);
  const displayNgramsForLine = Object.fromEntries(initialDisplay.map(ng => [ng, mergedNgrams[ng]]));
  const surviveOffsets = gameMode === 'survive' ? shuffleInitialSurviveOffsets() : null;
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
    spaceBlocked: false,
    surviveScore: 0,
    survivePerfectCombo: 0,
    surviveComboMultiplier: 1,
    surviveGoldenMode: false,
    surviveGoldenTimeLeft: 0,
    surviveGoldenCount: 0,
    surviveMaxCombo: 0,
    surviveNextGoldenWord: surviveOffsets?.golden ?? 0,
    surviveBombActive: false,
    surviveBombCountdown: 0,
    surviveNextBombWord: surviveOffsets?.bomb ?? 0,
    surviveNextFreezeWord: surviveOffsets?.freeze ?? 0,
    surviveFreezeLeft: 0,
    surviveFreezeBuffer: 0,
    survivePenaltyAppliedThisWord: false,
    surviveLastWordScore: null,
  };
}

export function useTypingEngine(requireCorrectWord = false) {
  const requireCorrectWordRef = useRef(requireCorrectWord);
  useEffect(() => { requireCorrectWordRef.current = requireCorrectWord; }, [requireCorrectWord]);

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
    // For survive mode, use secondCountRef to measure actual elapsed time
    const elapsedMs = s.gameMode === 'survive'
      ? secondCountRef.current * 1000
      : s.duration === 'infinite'
        ? s.timeLeft * 1000
        : (s.duration as number) * 1000;
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
      ...(s.gameMode === 'survive' && {
        surviveScore: s.surviveScore,
        surviveMaxCombo: s.surviveMaxCombo,
        surviveGoldenCount: s.surviveGoldenCount,
      }),
    };

    // Save survive personal best
    if (s.gameMode === 'survive') {
      const best = loadSurviveBest();
      if (s.surviveScore > best) saveSurviveBest(s.surviveScore);
    }

    // Persist per-bigram timing and struggling patterns to localStorage.
    // Custom mode is free practice — it must not feed the adaptive n-gram profile.
    if (s.gameMode !== 'custom') {
      saveTimingToStorage(s.ngramStats);
      updateStrugglingPatterns(s.ngramStats, s.ngramGraduated);
      saveActiveNgrams(s.ngrams);
      // The still-visible chips are exactly the not-yet-graduated patterns
      // (completed ones already left ngramDisplayOrder) — carry them forward.
      saveFocusCarryover(s.ngramDisplayOrder);
      incrementSessionCount();
      storedTimingRef.current = loadStoredTiming();
    }

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

      if (s.gameMode === 'survive') {
        // Survive: timeLeft is dynamic (bonus/penalty modify it directly); just decrement by 1
        setState(prev => {
          if (prev.testState !== 'running') return prev;
          const frozen = prev.surviveFreezeLeft > 0;
          const updates: Partial<EngineState> = {
            wpmHistory: [...prev.wpmHistory, newPoint],
          };

          // Survival countdown: paused while frozen; the freeze counter ticks instead.
          let timeLeft = prev.timeLeft;
          let freezeBuffer = prev.surviveFreezeBuffer;
          let freezeLeft = prev.surviveFreezeLeft;
          if (frozen) {
            freezeLeft = prev.surviveFreezeLeft - 1;
          } else {
            timeLeft = Math.max(0, timeLeft - 1);
          }

          // Golden mode countdown — keeps running even while frozen
          if (prev.surviveGoldenMode) {
            const gt = prev.surviveGoldenTimeLeft - 1;
            updates.surviveGoldenMode = gt > 0;
            updates.surviveGoldenTimeLeft = Math.max(0, gt);
          }
          // Bomb countdown — keeps running even while frozen
          if (prev.surviveBombActive && prev.surviveBombCountdown > 0) {
            const bt = prev.surviveBombCountdown - 1;
            if (bt <= 0) {
              updates.surviveBombActive = false;
              updates.surviveBombCountdown = 0;
              updates.surviveNextBombWord = prev.wordsCompleted + 7 + Math.floor(Math.random() * 4);
              // Explosion penalty buffers during a freeze, applies immediately otherwise.
              if (frozen) freezeBuffer -= 2;
              else timeLeft = Math.max(0, timeLeft - 2);
            } else {
              updates.surviveBombCountdown = bt;
            }
          }

          // Thaw: apply the net time changes accumulated during the freeze.
          if (frozen && freezeLeft === 0) {
            timeLeft = Math.min(90, Math.max(0, timeLeft + freezeBuffer));
            freezeBuffer = 0;
          }

          updates.timeLeft = timeLeft;
          updates.surviveFreezeLeft = freezeLeft;
          updates.surviveFreezeBuffer = freezeBuffer;
          return { ...prev, ...updates };
        });
        return;
      }

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
    if (state.fixedWords && state.fixedWordOffset >= state.fixedWords.length && state.testState === 'running' && state.wordsCompleted > 0) {
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
          return { ...next, spaceBlocked: false, line: { ...line, charStates: newCharStates }, currentChar: currentChar - 1 };
        }
        return { ...next, spaceBlocked: false };
      }

      if (e.key === ' ' && currentChar === word.length && (!requireCorrectWordRef.current || line.charStates[currentWord].every(s => s === 'correct'))) {
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

        // Add newly promoted to display or wait queue
        for (const ng of newlyPromoted) {
          if (justGraduated.has(ng)) continue;
          if (displayOrder.length < MAX_DISPLAY_PATTERNS) {
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

        // ── SURVIVE MODE SCORING ──────────────────────────────────────
        let surviveUpdates: Partial<EngineState> = {};
        if (next.gameMode === 'survive') {
          const wc = next.wordsCompleted; // value BEFORE incrementing
          const isGoldenWord = wc === next.surviveNextGoldenWord;
          const isFreezeWord = wc === next.surviveNextFreezeWord;
          const isBombWord   = next.surviveBombActive;
          const hadError     = next.currentWordHadError;

          const BASE_SCORES = [50, 100, 250, 500];
          const base = BASE_SCORES[next.difficultyLevel - 1] ?? 50;
          const inGoldenMode   = next.surviveGoldenMode && !hadError;
          const goldenWordBonus = isGoldenWord && !hadError;
          // Reward fast, accurate typing: fold live wpm + session accuracy into the score.
          const elapsedMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
          const liveWpm = elapsedMs > 1000 ? calcWpm(next.correctChars, elapsedMs) : 0;
          const liveAcc = calcAccuracy(next.correctChars, next.totalChars);
          const perfMult = accuracyScoreMult(liveAcc) * wpmScoreMult(liveWpm) * difficultyScoreMult(next.difficultyLevel);
          const scoreMult = (inGoldenMode || goldenWordBonus ? 2 : 1) * next.surviveComboMultiplier * perfMult;
          const wordScore = hadError ? 0 : Math.round(base * scoreMult);

          const newCombo = hadError ? 0 : next.survivePerfectCombo + 1;
          const newMult  = hadError ? 1 : Math.min(2, 1 + Math.floor(newCombo / 5) * 0.5);
          const newMaxCombo = Math.max(next.surviveMaxCombo, newCombo);

          const frozen = next.surviveFreezeLeft > 0;
          let timeAdjust = 0;
          if (!hadError && newCombo === 3) timeAdjust += 2;      // unlock streak: +2s
          else if (!hadError && newCombo > 3) timeAdjust += 1;   // each further perfect word: +1s
          // While frozen, time bonuses buffer and apply on thaw; otherwise apply now.
          const newTimeLeft = frozen ? next.timeLeft : Math.min(90, next.timeLeft + timeAdjust);
          const newFreezeBuffer = frozen ? next.surviveFreezeBuffer + timeAdjust : next.surviveFreezeBuffer;
          // Freeze word: pause the countdown for 2s (handled in the ticker).
          const newFreezeLeft = (isFreezeWord && !hadError) ? 2 : next.surviveFreezeLeft;

          let newGoldenMode = next.surviveGoldenMode;
          let newGoldenTimeLeft = next.surviveGoldenTimeLeft;
          let newGoldenCount = next.surviveGoldenCount;
          if (isGoldenWord && !hadError) {
            newGoldenMode = true;
            newGoldenTimeLeft = 5;
            newGoldenCount += 1;
          }

          const newWc = wc + 1; // wordsCompleted after this press
          // Reschedule consumed types, biasing toward combos (a fresh target may
          // snap onto another pending special word so they land together).
          const nextGolden = isGoldenWord
            ? rescheduleSpecial(newWc, 5, 4, [next.surviveNextFreezeWord, next.surviveNextBombWord])
            : next.surviveNextGoldenWord;
          const nextFreeze = isFreezeWord
            ? rescheduleSpecial(newWc, 5, 4, [nextGolden, next.surviveNextBombWord])
            : next.surviveNextFreezeWord;
          const nextBomb = isBombWord
            ? rescheduleSpecial(newWc, 7, 4, [nextGolden, nextFreeze])
            : next.surviveNextBombWord;

          // Activate bomb countdown if the word sliding into slot 0 is the bomb word
          const bombActivating = !isBombWord && newWc === next.surviveNextBombWord;

          surviveUpdates = {
            surviveScore: next.surviveScore + wordScore,
            survivePerfectCombo: newCombo,
            surviveComboMultiplier: newMult,
            surviveMaxCombo: newMaxCombo,
            surviveGoldenMode: newGoldenMode,
            surviveGoldenTimeLeft: newGoldenTimeLeft,
            surviveGoldenCount: newGoldenCount,
            surviveNextGoldenWord: nextGolden,
            surviveBombActive: bombActivating,
            surviveBombCountdown: bombActivating ? 3 : 0,
            surviveNextBombWord: nextBomb,
            surviveNextFreezeWord: nextFreeze,
            surviveFreezeLeft: newFreezeLeft,
            surviveFreezeBuffer: newFreezeBuffer,
            survivePenaltyAppliedThisWord: false,
            timeLeft: newTimeLeft,
            surviveLastWordScore: wordScore > 0 ? {
              value: wordScore,
              golden: inGoldenMode || goldenWordBonus,
              id: (next.surviveLastWordScore?.id ?? 0) + 1,
            } : next.surviveLastWordScore,
          };
        }
        // ─────────────────────────────────────────────────────────────

        // Word-count mode: finish when target reached
        if (next.gameMode === 'words' && next.wordsCompleted + 1 >= (next.wordTarget ?? Infinity)) {
          return { ...next, ...shared, ...surviveUpdates };
        }

        // Fixed-word modes (quote/custom): advance window
        if (next.fixedWords) {
          const nextOffset = next.fixedWordOffset + 1;
          const fwWords = next.fixedWords.slice(nextOffset, nextOffset + 3);
          if (fwWords.length === 0) {
            // Last word was just completed — effect will call finishTest
            return { ...next, ...shared, ...surviveUpdates, fixedWordOffset: nextOffset };
          }
          return {
            ...next,
            ...shared,
            ...surviveUpdates,
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
          ...surviveUpdates,
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

      // Space pressed but blocked (race mode only): word complete but has errors
      if (e.key === ' ') {
        if (requireCorrectWordRef.current && currentChar === word.length) return { ...next, spaceBlocked: true };
        return next;
      }

      // Regular character — only accept up to word length, never auto-advance word
      if (currentChar >= word.length) return next;

      const expected = word[currentChar];
      const isCorrect = e.key === expected;

      const newCharStates = line.charStates.map(row => [...row]);
      newCharStates[currentWord][currentChar] = isCorrect ? 'correct' : 'incorrect';

      // Accumulate bigram/trigram stats on every keypress (including backspaced errors)
      const newNgramStats = updateNgramStats(word, currentChar, isCorrect, next.ngramStats, validDelta);

      // Survive mode: wrong key triggers immediate effects
      if (next.gameMode === 'survive' && !isCorrect) {
        const bombExplosion = next.surviveBombActive;
        // Bomb: -2s immediately. Normal mistake: -0.5s once per word. Not both.
        const timePenalty = bombExplosion ? 2 : (!next.survivePenaltyAppliedThisWord ? 0.5 : 0);
        // While frozen the timer is paused — penalties buffer and apply on thaw.
        const frozen = next.surviveFreezeLeft > 0;
        const newTimeLeft = frozen ? next.timeLeft : Math.max(0, next.timeLeft - timePenalty);
        const newFreezeBuffer = frozen ? next.surviveFreezeBuffer - timePenalty : next.surviveFreezeBuffer;
        const nextBombWord = bombExplosion
          ? next.wordsCompleted + 7 + Math.floor(Math.random() * 4)
          : next.surviveNextBombWord;
        return {
          ...next,
          spaceBlocked: false,
          line: { ...line, charStates: newCharStates },
          currentChar: currentChar + 1,
          correctChars: next.correctChars,
          totalChars: next.totalChars + 1,
          errorCount: next.errorCount + 1,
          currentWordHadError: true,
          ngramStats: newNgramStats,
          timeLeft: newTimeLeft,
          surviveFreezeBuffer: newFreezeBuffer,
          survivePenaltyAppliedThisWord: true,
          survivePerfectCombo: 0,
          surviveComboMultiplier: 1,
          surviveBombActive: bombExplosion ? false : next.surviveBombActive,
          surviveBombCountdown: bombExplosion ? 0 : next.surviveBombCountdown,
          surviveNextBombWord: nextBombWord,
        };
      }

      return {
        ...next,
        spaceBlocked: false,
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

  const startFocusedSession = useCallback((pattern: string, mode: GameMode = 'timed', length?: number) => {
    stopTicker();
    secondCountRef.current = 0;
    startTimeRef.current = null;
    markPatternPracticed(pattern);
    const focusNgrams = { [pattern]: 5 };

    let base: EngineState;
    if (mode === 'words') {
      const target = (length as WordCountTarget) ?? 25;
      setDuration('infinite');
      base = buildInitialState('infinite', 'words', { wordTarget: target });
    } else if (mode === 'survive') {
      setDuration(15);
      base = buildInitialState(15, 'survive'); // keeps shuffled survive offsets
    } else {
      const dur = (length as TimedMode) ?? 30;
      setDuration(dur);
      base = buildInitialState(dur);
    }
    setState({
      ...base,
      focusedPattern: pattern,
      ngrams: focusNgrams,
      line: makeLineData(generateLine(focusNgrams, 3)),
    });
  }, [stopTicker]);

  const startWordCountSession = useCallback((target: number) => {
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

  const startSurviveSession = useCallback(() => {
    stopTicker();
    secondCountRef.current = 0;
    startTimeRef.current = null;
    clearActiveNgrams();
    setDuration(15);
    setState(buildInitialState(15, 'survive'));
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
    startSurviveSession,
    endTest,
  };
}
