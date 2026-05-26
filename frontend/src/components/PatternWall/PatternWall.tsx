import { useState } from 'react';
import type { PatternRecord } from '../../hooks/usePatternLibrary';
import type { TimedMode } from '../../types';

interface Props {
  library: Record<string, PatternRecord>;
  onPractice: (pattern: string, duration: TimedMode) => void;
}

const MODES: TimedMode[] = [15, 30, 60, 120];

interface CardProps {
  record: PatternRecord;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPractice: (pattern: string, duration: TimedMode) => void;
}

function PatternCard({ record, isOpen, onOpen, onClose, onPractice }: CardProps) {
  const { pattern, completed, bestWpm, bestAccuracy, sessionCount } = record;

  const borderClasses = completed
    ? 'border-green-500/30 bg-green-950/15 hover:border-green-400/50'
    : 'border-red-500/40 bg-red-950/20 hover:border-red-400/70';

  const patternTextClass = completed ? 'text-green-300' : 'text-gray-100';

  if (isOpen) {
    return (
      <div className={`flex flex-col items-center gap-3 px-6 py-5 rounded-xl border ${borderClasses}`}>
        <span className={`font-mono text-3xl tracking-widest font-semibold ${patternTextClass}`}>
          {pattern}
        </span>

        <div className="animate-fade-in flex flex-col items-center gap-1">
          {sessionCount && sessionCount > 0 ? (
            <>
              <div className="flex items-center gap-3 text-sm font-mono">
                <span className="text-yellow-400 font-semibold">{bestWpm} wpm</span>
                <span className="text-gray-700">·</span>
                <span className="text-gray-400">{bestAccuracy}% acc</span>
              </div>
              <span className="text-xs text-gray-600">
                {sessionCount} session{sessionCount !== 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-600">no sessions yet</span>
          )}
        </div>

        <div className="w-full h-px bg-gray-800" />

        <p className="text-xs text-gray-500">choose duration</p>
        <div className="flex gap-2">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => onPractice(pattern, m)}
              className="px-3 py-1.5 rounded-lg text-sm font-mono bg-gray-800 text-gray-300 hover:bg-yellow-400 hover:text-gray-900 transition-colors"
            >
              {m}s
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-gray-700 hover:text-gray-500 transition-colors"
        >
          cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onOpen}
      className={`flex flex-col items-center gap-2 px-6 py-5 rounded-xl border transition-all duration-150 hover:scale-105 group ${borderClasses}`}
    >
      <span className={`font-mono text-3xl tracking-widest font-semibold ${patternTextClass}`}>
        {pattern}
      </span>
      {completed
        ? <span className="text-xs text-green-500 font-medium">mastered</span>
        : <span className="text-xs text-red-400/70 group-hover:text-red-400 transition-colors">practice →</span>
      }
    </button>
  );
}

export function PatternWall({ library, onPractice }: Props) {
  const [activePattern, setActivePattern] = useState<string | null>(null);

  const entries = Object.values(library).sort((a, b) => b.totalErrors - a.totalErrors);

  if (entries.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-32">
        <p className="text-gray-400 text-lg font-medium">your pattern wall is empty</p>
        <p className="text-gray-600 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
          finish a typing test and your weak letter combinations will appear here
        </p>
      </div>
    );
  }

  const pending = entries.filter(e => !e.completed);
  const done = entries.filter(e => e.completed);

  const makeCardProps = (p: PatternRecord) => ({
    key: p.pattern,
    record: p,
    isOpen: activePattern === p.pattern,
    onOpen: () => setActivePattern(p.pattern),
    onClose: () => setActivePattern(null),
    onPractice,
  });

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex items-center gap-6 mb-8 text-sm font-mono">
        <span className="text-gray-500">
          <span className="text-red-400 font-semibold">{pending.length}</span> to practice
        </span>
        <span className="text-gray-700">·</span>
        <span className="text-gray-500">
          <span className="text-green-400 font-semibold">{done.length}</span> mastered
        </span>
      </div>

      <div className="grid grid-cols-2 gap-0 divide-x divide-gray-800">
        <section className="pr-8">
          <h2 className="text-[11px] text-gray-600 font-medium uppercase tracking-[0.2em] mb-4">
            needs practice
          </h2>
          {pending.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {pending.map(p => <PatternCard {...makeCardProps(p)} />)}
            </div>
          ) : (
            <p className="text-gray-700 text-sm">nothing here yet</p>
          )}
        </section>

        <section className="pl-8">
          <h2 className="text-[11px] text-gray-600 font-medium uppercase tracking-[0.2em] mb-4">
            mastered
          </h2>
          {done.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {done.map(p => <PatternCard {...makeCardProps(p)} />)}
            </div>
          ) : (
            <p className="text-gray-700 text-sm">complete a practice session to master patterns</p>
          )}
        </section>
      </div>
    </div>
  );
}
