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
  onChangeDuration: (d: TimedMode) => void;
  onChangeMode: (m: GameMode) => void;
  onChangeWordTarget: (t: WordCountTarget) => void;
}

export function TimerBar({
  testState, timeLeft, duration, gameMode, wordTarget, wordsCompleted,
  onChangeDuration, onChangeMode, onChangeWordTarget,
}: Props) {
  if (testState === 'running') {
    if (gameMode === 'words') {
      return (
        <div className="flex justify-center mb-6">
          <span className="text-lg font-mono text-gray-500 dark:text-gray-400">
            <span className="text-yellow-400 font-bold">{wordsCompleted}</span>
            <span className="text-gray-600 dark:text-gray-500"> / {wordTarget}</span>
          </span>
        </div>
      );
    }
    if (gameMode === 'quote' || gameMode === 'custom') {
      return null;
    }
    if (gameMode === 'survive') {
      const urgent = timeLeft <= 5;
      const warning = timeLeft <= 10;
      return (
        <div className="flex justify-center mb-6">
          <span className={`text-3xl font-mono font-bold transition-colors ${
            urgent ? 'text-red-400 animate-pulse' : warning ? 'text-orange-400' : 'text-yellow-400'
          }`}>
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
