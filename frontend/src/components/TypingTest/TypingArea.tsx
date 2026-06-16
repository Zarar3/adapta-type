import { useCallback, useEffect, useRef, useState } from 'react';
import { WordDisplay } from './WordDisplay';
import type { WordFlags } from './WordDisplay';
import { SurviveHUD } from './SurviveHUD';
import { TimerBar } from './TimerBar';
import { calcWpm, calcAccuracy } from '../../lib/statsCalculator';
import { loadSurviveBest } from '../../lib/ngramTracker';
import { accuracyScoreMult, wpmScoreMult, difficultyScoreMult } from '../../lib/surviveScoring';
import type { TestState, TimedMode, GameMode, WordCountTarget, Quote } from '../../types';

function slot(nextAt: number, completed: number): number | null {
  const off = nextAt - completed;
  return off >= 0 && off <= 2 ? off : null;
}

export interface SurviveState {
  score: number;
  combo: number;
  multiplier: number;
  goldenMode: boolean;
  goldenTimeLeft: number;
  bombActive: boolean;
  bombCountdown: number;
  nextGoldenWord: number;
  nextBombWord: number;
  nextFreezeWord: number;
  lastWordScore: { value: number; golden: boolean; id: number } | null;
  currentWordHadError: boolean;
  liveWpm: number;
  freezeLeft: number;
}

interface LineData {
  words: string[];
  charStates: ('untyped' | 'correct' | 'incorrect' | 'extra')[][];
}

interface Props {
  testState: TestState;
  timeLeft: number;
  duration: TimedMode;
  gameMode: GameMode;
  wordTarget: WordCountTarget | null;
  wordsCompleted: number;
  currentQuote: Quote | null;
  customText: string;
  line: LineData;
  currentWord: number;
  currentChar: number;
  ngramDisplayOrder: string[];
  ngramStreaks: Record<string, number>;
  difficultyLevel: number;
  focusedPattern: string | null;
  showLineHint: boolean;
  correctChars: number;
  totalChars: number;
  onKeyDown: (e: KeyboardEvent) => void;
  onChangeDuration: (d: TimedMode) => void;
  onChangeMode: (m: GameMode) => void;
  onChangeWordTarget: (t: WordCountTarget) => void;
  onChangeCustomText: (t: string) => void;
  onStartCustom: () => void;
  onRestart: () => void;
  onEndTest?: () => void;
  playCorrect?: () => void;
  playWrong?: () => void;
  playSurviveCleanWord?: () => void;
  playSurviveGolden?: () => void;
  playSurviveBombExplode?: () => void;
  playSurviveBombDefuse?: () => void;
  playSurviveFreeze?: () => void;
  spaceBlocked?: boolean;
  isRaceMode?: boolean;
  surviveState?: SurviveState | null;
}

interface ScorePopup { id: number; value: number; golden: boolean; }

const DIFFICULTY_LABELS = ['', 'easy', 'medium', 'hard', 'expert'];

export function TypingArea({
  testState, timeLeft, duration, gameMode, wordTarget, wordsCompleted, currentQuote, customText,
  line, currentWord, currentChar, ngramDisplayOrder, ngramStreaks, difficultyLevel, focusedPattern, showLineHint,
  correctChars, totalChars, onKeyDown, onChangeDuration, onChangeMode, onChangeWordTarget,
  onChangeCustomText, onStartCustom, onRestart, onEndTest, playCorrect, playWrong,
  playSurviveCleanWord, playSurviveGolden, playSurviveBombExplode, playSurviveBombDefuse, playSurviveFreeze,
  spaceBlocked, isRaceMode = false, surviveState = null,
}: Props) {
  const focusPatterns = focusedPattern ? [] : ngramDisplayOrder;

  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyWithSound = useCallback((e: KeyboardEvent) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const expected = line.words[currentWord]?.[currentChar];
      if (expected !== undefined) {
        e.key === expected ? playCorrect?.() : playWrong?.();
      }
    }
    onKeyDown(e);
  }, [line, currentWord, currentChar, onKeyDown, playCorrect, playWrong]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.addEventListener('keydown', handleKeyWithSound);
    return () => el.removeEventListener('keydown', handleKeyWithSound);
  }, [handleKeyWithSound]);

  const [capsLock, setCapsLock] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => setCapsLock(e.getModifierState('CapsLock'));
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', handler);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', handler); };
  }, []);

  const [flashKey, setFlashKey] = useState(0);
  const prevDifficulty = useRef(difficultyLevel);
  useEffect(() => {
    if (difficultyLevel !== prevDifficulty.current) {
      setFlashKey(k => k + 1);
      prevDifficulty.current = difficultyLevel;
    }
  }, [difficultyLevel]);

  // Score popup state — driven by surviveState.lastWordScore changes
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const lastScoreIdRef = useRef<number | null>(null);
  useEffect(() => {
    const lws = surviveState?.lastWordScore;
    if (!lws || lws.id === lastScoreIdRef.current) return;
    lastScoreIdRef.current = lws.id;
    const popup: ScorePopup = { id: lws.id, value: lws.value, golden: lws.golden };
    setScorePopups(p => [...p, popup]);
    const t = setTimeout(() => setScorePopups(p => p.filter(x => x.id !== popup.id)), 900);
    return () => clearTimeout(t);
  }, [surviveState?.lastWordScore]);

  // Survive sound effects — track previous values to detect transitions
  const prevGoldenModeRef   = useRef(false);
  const prevBombActiveRef   = useRef(false);
  const prevScoreIdForSound = useRef<number | null>(null);
  const prevNextFreezeRef   = useRef<number>(0);
  useEffect(() => {
    if (!surviveState) return;

    // Clean word completed (new popup appeared)
    const currentScoreId = surviveState.lastWordScore?.id ?? null;
    if (currentScoreId !== null && currentScoreId !== prevScoreIdForSound.current) {
      playSurviveCleanWord?.();
    }

    // Golden mode just activated
    if (surviveState.goldenMode && !prevGoldenModeRef.current) {
      playSurviveGolden?.();
    }

    // Bomb deactivated — distinguish explosion (no new score) from defuse (new score appeared)
    if (!surviveState.bombActive && prevBombActiveRef.current) {
      if (currentScoreId !== prevScoreIdForSound.current) {
        playSurviveBombDefuse?.();
      } else {
        playSurviveBombExplode?.();
      }
    }

    // Freeze word just completed (nextFreezeWord advanced)
    if (surviveState.nextFreezeWord !== prevNextFreezeRef.current && prevNextFreezeRef.current !== 0) {
      playSurviveFreeze?.();
    }

    prevGoldenModeRef.current   = surviveState.goldenMode;
    prevBombActiveRef.current   = surviveState.bombActive;
    prevScoreIdForSound.current = currentScoreId;
    prevNextFreezeRef.current   = surviveState.nextFreezeWord;
  }, [surviveState, playSurviveCleanWord, playSurviveGolden, playSurviveBombExplode, playSurviveBombDefuse, playSurviveFreeze]);

  const [showGuide, setShowGuide] = useState(false);

  // In survive mode timeLeft is dynamic (bonuses/penalties move it), so
  // (duration - timeLeft) is NOT elapsed time. Use the engine's real-elapsed wpm instead.
  const elapsed = duration === 'infinite'
    ? timeLeft * 1000
    : ((duration as number) - timeLeft) * 1000;
  const liveWpm = gameMode === 'survive'
    ? (surviveState?.liveWpm ?? 0)
    : elapsed > 0 ? calcWpm(correctChars, elapsed) : 0;
  const liveAccuracy = calcAccuracy(correctChars, totalChars);

  // Word flags for special word highlighting.
  // If the active word (slot 0) already had an error, it loses its special highlight.
  const wordFlags: WordFlags | null = (gameMode === 'survive' && surviveState) ? (() => {
    const failed = surviveState.currentWordHadError;
    const goldenSlot = slot(surviveState.nextGoldenWord, wordsCompleted);
    const freezeSlot = slot(surviveState.nextFreezeWord, wordsCompleted);
    return {
      golden: goldenSlot === 0 && failed ? null : goldenSlot,
      bomb:   surviveState.bombActive ? 0 : slot(surviveState.nextBombWord, wordsCompleted),
      freeze: freezeSlot === 0 && failed ? null : freezeSlot,
      bombCountdown: surviveState.bombCountdown,
    };
  })() : null;

  const surviveBest = gameMode === 'survive' ? loadSurviveBest() : 0;

  return (
    <div
      className={`w-full ${isRaceMode ? 'max-w-2xl' : 'max-w-5xl'} mx-auto cursor-text`}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        autoFocus
        readOnly
        inputMode="text"
        aria-hidden
      />

      {!isRaceMode && (
        <TimerBar
          testState={testState}
          timeLeft={timeLeft}
          duration={duration}
          gameMode={gameMode}
          wordTarget={wordTarget}
          wordsCompleted={wordsCompleted}
          frozen={(surviveState?.freezeLeft ?? 0) > 0}
          onChangeDuration={onChangeDuration}
          onChangeMode={onChangeMode}
          onChangeWordTarget={onChangeWordTarget}
        />
      )}

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
              disabled={customText.trim().split(/\s+/).filter(Boolean).length < 3}
              className="px-4 py-1.5 rounded bg-yellow-400 text-gray-900 text-sm font-medium
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              start
            </button>
          </div>
        </div>
      )}

      {gameMode === 'quote' && currentQuote && testState === 'running' && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-600 mb-3 font-mono">
          — {currentQuote.author}{currentQuote.source ? `, ${currentQuote.source}` : ''}
        </p>
      )}

      {testState === 'idle' && !isRaceMode && (
        <p className="text-center text-gray-400 dark:text-gray-600 text-sm mb-4">click here or start typing</p>
      )}

      {gameMode === 'survive' && testState === 'idle' && (
        <div className="text-center mb-4">
          {surviveBest > 0 && (
            <p className="text-xs font-mono text-gray-500 mb-2">
              best: <span className="text-yellow-400">{surviveBest}</span> pts
            </p>
          )}
          <button
            onClick={() => setShowGuide(g => !g)}
            className="text-xs font-mono text-gray-600 hover:text-gray-400 transition-colors"
          >
            {showGuide ? 'hide guide' : 'how it works'}
          </button>
          {showGuide && (
            <div className="mt-3 max-w-xs mx-auto bg-gray-900 rounded-lg p-3 text-left text-xs font-mono space-y-1.5 text-gray-400">
              <p><span className="text-yellow-400">timer</span> starts at 15s — don't let it hit 0</p>
              <p><span className="text-green-400">3 clean words</span> → +2s · each extra → +1s</p>
              <p><span className="text-red-400">any typo</span> → −0.5s · resets streak &amp; multiplier</p>
              <p><span className="text-yellow-300">✦ golden word</span> → correct = 2× score for 5s</p>
              <p><span className="text-red-400 font-bold">bomb word</span> → typo = −2s explosion</p>
              <p><span className="text-sky-300">❄ freeze word</span> → correct = freezes the timer for 2s (it can't drop) — the clock turns icy blue</p>
              <p><span className="text-yellow-400">5 clean words</span> → multiplier up (max 2×)</p>
              <p><span className="text-fuchsia-400">combo word</span> → stacks effects (e.g. ✦❄ gold + freeze)</p>
              <p className="text-gray-500 pt-1 border-t border-gray-800 mt-1">score multipliers — they stack:</p>
              <p><span className="text-sky-300">wpm</span> → 40→1.1× · 50→1.15× · 60→1.25× · 80→1.5× · 100→2× · 120→2.5×</p>
              <p><span className="text-green-400">acc</span> → 85%→1.1× · 90%→1.25× · 95%+→1.5×</p>
              <p><span className="text-orange-400">difficulty</span> → easy 1× · medium 1.1× · hard 1.25× · expert 1.5×</p>
              <p className="text-gray-600 pt-1">special words lose their highlight if you typo them</p>
            </div>
          )}
        </div>
      )}

      {gameMode === 'survive' && testState !== 'idle' && surviveState && (
        <SurviveHUD
          score={surviveState.score}
          combo={surviveState.combo}
          multiplier={surviveState.multiplier}
          goldenMode={surviveState.goldenMode}
          goldenTimeLeft={surviveState.goldenTimeLeft}
          accMult={accuracyScoreMult(liveAccuracy)}
          wpmMult={wpmScoreMult(liveWpm)}
          diffMult={difficultyScoreMult(difficultyLevel)}
          freezeLeft={surviveState.freezeLeft}
        />
      )}

      {testState === 'running' && (
        <>
          <div className="flex justify-center gap-6 mb-4 text-sm font-mono">
            <span className="text-gray-600 dark:text-gray-300">{liveWpm} <span className="text-yellow-400/60">wpm</span></span>
            <span className="text-gray-600 dark:text-gray-300">{liveAccuracy}% <span className="text-yellow-400/60">acc</span></span>
          </div>
          {!isRaceMode && gameMode !== 'custom' && (
            <div className="flex justify-end mb-1">
              <span
                key={flashKey}
                className={`text-xs font-mono animate-flash ${
                  difficultyLevel >= 4 ? 'text-red-400' :
                  difficultyLevel >= 3 ? 'text-orange-400' :
                  difficultyLevel >= 2 ? 'text-yellow-400' : 'text-green-400'
                }`}
              >
                {DIFFICULTY_LABELS[difficultyLevel]}
              </span>
            </div>
          )}
        </>
      )}

      {capsLock && (
        <p className="text-center text-yellow-500/70 text-xs mb-3">caps lock is on</p>
      )}

      {!isRaceMode && gameMode !== 'custom' && focusPatterns.length > 0 && testState !== 'idle' && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-gray-500">focusing on:</span>
          {focusPatterns.map(pattern => {
            const streak = ngramStreaks[pattern] ?? 0;
            return (
              <div
                key={pattern}
                className="flex flex-col items-center gap-1 px-2 py-1 rounded bg-yellow-400/10 border border-yellow-400/20"
              >
                <span className="text-yellow-300 text-xs font-mono tracking-wide">{pattern}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-1.5 rounded-sm ${i < streak ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-700'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Word display + centered score popups */}
      <div className="select-none relative">
        {gameMode === 'survive' && scorePopups.length > 0 && (
          <div className="absolute -top-8 inset-x-0 flex justify-center pointer-events-none overflow-visible">
            {scorePopups.map(p => (
              <span
                key={p.id}
                className={`absolute font-mono text-sm font-bold animate-float-up ${p.golden ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                +{p.value}{p.golden ? ' ✦' : ''}
              </span>
            ))}
          </div>
        )}
        <WordDisplay
          words={line.words}
          charStates={line.charStates}
          isActive
          activeWord={currentWord}
          activeChar={currentChar}
          showHint={showLineHint}
          wordFlags={wordFlags}
        />
        {spaceBlocked && (
          <p className="text-center text-xs font-mono text-red-400/70 mt-2">fix the highlighted word first</p>
        )}
        {surviveState?.bombActive && (
          <p className="text-center text-xs font-mono text-red-400 mt-2 animate-pulse">type this word perfectly — any mistake detonates it</p>
        )}
      </div>

      {testState === 'running' && (
        <div className="flex justify-center gap-4 mt-6">
          {duration === 'infinite' && gameMode === 'timed' && (
            <button
              onClick={onEndTest}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors font-mono"
            >
              end
            </button>
          )}
          <button
            onClick={onRestart}
            className="text-xs text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500 transition-colors font-mono"
          >
            restart
          </button>
        </div>
      )}
    </div>
  );
}
