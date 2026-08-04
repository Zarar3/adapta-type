import type { TestState, TimedMode, GameMode, WordCountTarget } from '../../types';

const TIMED_MODES: TimedMode[] = [15, 30, 60, 120, 'infinite'];
const WORD_TARGETS: WordCountTarget[] = [10, 25, 50, 100];
const GAME_MODES: GameMode[] = ['timed', 'words', 'quote', 'custom', 'survive'];

interface Props {
  testState: TestState;
  timeLeft: number;
  duration: TimedMode;
  gameMode: GameMode;
  wordTarget: WordCountTarget | null;
  wordsCompleted: number;
  /** 0–1 share of the target text typed so far; null when the mode has no fixed length. */
  progress?: number | null;
  frozen?: boolean;
  onChangeDuration: (d: TimedMode) => void;
  onChangeMode: (m: GameMode) => void;
  onChangeWordTarget: (t: WordCountTarget) => void;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
      <div
        className="h-full rounded-full bg-yellow-400 transition-[width] duration-100 ease-out"
        style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }}
      />
    </div>
  );
}

export function TimerBar({
  testState, timeLeft, duration, gameMode, wordTarget, wordsCompleted, progress, frozen,
  onChangeDuration, onChangeMode, onChangeWordTarget,
}: Props) {
  if (testState === 'running') {
    if (gameMode === 'words') {
      return (
        <div className="w-full max-w-md mx-auto mb-6">
          <div className="flex justify-center mb-2">
            <span className="text-lg font-mono text-gray-500 dark:text-gray-400">
              <span className="text-yellow-400 font-bold">{wordsCompleted}</span>
              <span className="text-gray-600 dark:text-gray-500"> / {wordTarget}</span>
            </span>
          </div>
          <ProgressBar value={progress ?? 0} />
        </div>
      );
    }
    if (gameMode === 'quote' || gameMode === 'custom') {
      if (progress === null || progress === undefined) return null;
      return (
        <div className="w-full max-w-md mx-auto mb-6">
          <div className="flex justify-center mb-2">
            <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
              <span className="text-yellow-400 font-bold">{Math.round(progress * 100)}</span>
              <span className="text-gray-600 dark:text-gray-500">%</span>
            </span>
          </div>
          <ProgressBar value={progress} />
        </div>
      );
    }
    if (gameMode === 'survive') {
      const urgent = timeLeft <= 5;
      const warning = timeLeft <= 10;
      // Frozen overrides urgency coloring — the timer reads as iced over.
      const timerColor = frozen
        ? 'text-sky-300 animate-pulse'
        : urgent ? 'text-red-400 animate-pulse' : warning ? 'text-orange-400' : 'text-yellow-400';
      return (
        <div className="flex justify-center items-center gap-2 mb-6">
          {frozen && <span className="text-2xl text-sky-300 animate-pulse">❄</span>}
          <span className={`text-3xl font-mono font-bold transition-colors ${timerColor}`}>
            {timeLeft}
          </span>
        </div>
      );
    }
    return (
      <div className="flex justify-center mb-6">
        <span className="text-3xl font-mono font-bold text-yellow-400">{timeLeft}</span>
      </div>
    );
  }

  if (testState === 'idle') {
    return (
      <div className="mb-6">
        <div className="flex justify-center gap-1 mb-4">
          {GAME_MODES.map(m => (
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
        {gameMode === 'timed' && (
          <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
            {TIMED_MODES.map(m => (
              <button key={m} onClick={() => onChangeDuration(m)}
                className={`px-3 sm:px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  m === duration ? 'bg-yellow-400 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}>
                {m === 'infinite' ? '∞' : `${m}s`}
              </button>
            ))}
          </div>
        )}
        {gameMode === 'words' && (
          <div className="flex justify-center gap-2">
            {WORD_TARGETS.map(t => (
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
      </div>
    );
  }

  return null;
}
