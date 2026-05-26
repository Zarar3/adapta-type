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
    if (duration === 'infinite') {
      return (
        <div className="flex justify-center mb-6">
          <span className="text-3xl font-mono font-bold text-gray-500">{timeLeft}</span>
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
      <div className="flex justify-center gap-3 mb-6">
        {MODES.map(m => (
          <button
            key={m}
            onClick={() => onChangeDuration(m)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              m === duration
                ? 'bg-yellow-400 text-gray-900'
                : 'text-gray-400 hover:text-gray-200'
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
