import { useCallback, useEffect, useRef, useState } from 'react';
import { generateLine, generateWord, hasSufficientCoverage } from '../lib/wordSelector';
import { updateNgramStats, promoteNgrams } from '../lib/ngramTracker';
import type { NgramStats } from '../lib/ngramTracker';
import { calcWpm, calcRawWpm, calcAccuracy } from '../lib/statsCalculator';
import type { CharState, TestState, TimedMode, WpmDataPoint, TestResults, DifficultyChange } from '../types';

function streakThreshold(duration: TimedMode): number {
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
  timeLeft: number;
  // Only the active line is held in state; the next line is generated on completion
  line: LineData;
  currentWord: number;
  currentChar: number;
  ngrams: Record<string, number>;
  ngramStreaks: Record<string, number>;   // consecutive correct encounters per n-gram
  ngramGraduated: Record<string, number>; // patterns cleared during this test
  ngramStats: NgramStats;                 // per-keystroke bigram/trigram accuracy tally
  focusedPattern: string | null;          // set during a single-pattern practice session
  difficultyLevel: number;                // 1–4, increases as user improves
  difficultyHistory: DifficultyChange[];  // when difficulty changed during the test
  showLineHint: boolean;                  // true until the first line is completed
  perfectWordStreak: number;              // consecutive fully-correct words
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

function buildInitialState(duration: TimedMode): EngineState {
  return {
    testState: 'idle',
    duration,
    timeLeft: duration,
    line: makeLineData(generateLine({}, 3, 1)),
    currentWord: 0,
    currentChar: 0,
    ngrams: {},
    ngramStreaks: {},
    ngramGraduated: {},
    ngramStats: {},
    focusedPattern: null,
    difficultyLevel: 1,
    difficultyHistory: [],
    showLineHint: true,
    perfectWordStreak: 0,
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
    const elapsedMs = s.duration * 1000;
    const wpm = calcWpm(s.correctChars, elapsedMs);
    const rawWpm = calcRawWpm(s.totalChars, elapsedMs);
    const accuracy = calcAccuracy(s.correctChars, s.totalChars);
    const results: TestResults = {
      wpm, rawWpm, accuracy,
      duration: s.duration,
      wpmHistory: s.wpmHistory,
      ngramMistakes: s.ngrams,
      ngramGraduated: s.ngramGraduated,
      difficultyHistory: s.difficultyHistory,
    };

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
      const timeLeft = s.duration - secondCountRef.current;
      const wpm = calcWpm(s.correctChars, elapsed);
      const rawWpm = calcRawWpm(s.totalChars, elapsed);

      const newPoint: WpmDataPoint = {
        t: secondCountRef.current,
        wpm,
        raw: rawWpm,
        errors: s.errorCount,
      };

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
    }, 1000);

    void initialState;
  }, []);

  // Watch for timeLeft hitting 0
  useEffect(() => {
    if (state.testState === 'running' && state.timeLeft <= 0) {
      finishTest(stateRef.current);
    }
  }, [state.timeLeft, state.testState, finishTest]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore modifier keys and function keys
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length > 1 && e.key !== 'Backspace' && e.key !== ' ') return;

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
        const wordStates = line.charStates[currentWord];
        const wordErrors = wordStates.filter(s => s === 'incorrect').length;

        // A word is only "perfect" if no wrong key was pressed, even if backspaced and fixed
        const perfect = !next.currentWordHadError;
        const newStreak = perfect ? next.perfectWordStreak + 1 : 0;
        let newDifficulty = next.difficultyLevel;
        let adjustedStreak = newStreak;
        if (newStreak >= streakThreshold(next.duration) && newDifficulty < 4) { newDifficulty += 1; adjustedStreak = 0; }
        if (wordErrors > 2 && newDifficulty > 1) { newDifficulty -= 1; adjustedStreak = 0; }

        // Promote bigrams/trigrams that now meet the error threshold, then drop any
        // patterns with too few words in the list to be worth practising
        const promoted = promoteNgrams(word, next.ngramStats, next.ngrams, next.ngramGraduated);
        const ngramsAfterPromotion = Object.fromEntries(
          Object.entries(promoted).filter(([ng]) => hasSufficientCoverage(ng))
        );

        // Update streaks, graduate mastered patterns, clear them from ngramStats
        const { ngrams: updatedNgrams, ngramStreaks: updatedStreaks, ngramGraduated: updatedGraduated, ngramStats: updatedStats } =
          updateStreaks(word, wordStates, ngramsAfterPromotion, next.ngramStreaks, next.ngramGraduated, next.ngramStats);

        const updatedDifficultyHistory = newDifficulty !== next.difficultyLevel
          ? [...next.difficultyHistory, { t: next.duration - next.timeLeft, level: newDifficulty }]
          : next.difficultyHistory;

        const shared = {
          ngrams: updatedNgrams,
          ngramStreaks: updatedStreaks,
          ngramGraduated: updatedGraduated,
          ngramStats: updatedStats,
          difficultyLevel: newDifficulty,
          difficultyHistory: updatedDifficultyHistory,
          perfectWordStreak: adjustedStreak,
          currentWordHadError: false,
        };

        // Always slide: completed word drops off, queued word moves to position 0, new word fills position 1
        const lineNgrams = next.focusedPattern
          ? { [next.focusedPattern]: 5 }
          : updatedNgrams;
        const nextWord = generateWord(lineNgrams, newDifficulty, [word, line.words[1], line.words[2]]);
        const newWords = [line.words[1], line.words[2], nextWord];
        return {
          ...next,
          ...shared,
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
      const newNgramStats = updateNgramStats(word, currentChar, isCorrect, next.ngramStats);

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
    secondCountRef.current = 0;
    startTimeRef.current = null;
    setState(buildInitialState(duration));
  }, [duration, stopTicker]);

  const changeDuration = useCallback((d: TimedMode) => {
    stopTicker();
    setDuration(d);
    setState(buildInitialState(d));
  }, [stopTicker]);

  const startFocusedSession = useCallback((pattern: string, dur: TimedMode) => {
    stopTicker();
    secondCountRef.current = 0;
    startTimeRef.current = null;
    const focusNgrams = { [pattern]: 5 };
    setDuration(dur);
    setState({
      ...buildInitialState(dur),
      focusedPattern: pattern,
      ngrams: focusNgrams,
      line: makeLineData(generateLine(focusNgrams, 3)),
    });
  }, [stopTicker]);

  // Cleanup on unmount
  useEffect(() => () => stopTicker(), [stopTicker]);

  return {
    state,
    handleKeyDown,
    reset,
    changeDuration,
    startFocusedSession,
  };
}
