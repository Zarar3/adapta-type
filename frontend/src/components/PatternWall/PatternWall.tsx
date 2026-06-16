import { useState } from 'react';
import type { PatternRecord } from '../../hooks/usePatternLibrary';
import { loadStrugglingPatterns } from '../../lib/ngramTracker';
import type { GameMode } from '../../types';
import { PracticePicker } from '../PracticePicker';

interface Props {
  library: Record<string, PatternRecord>;
  onPractice: (pattern: string, mode: GameMode, length?: number) => void;
  onReset: () => void;
}

interface CardProps {
  record: PatternRecord;
  isOpen: boolean;
  isStruggling: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPractice: (pattern: string, mode: GameMode, length?: number) => void;
}

function PatternCard({ record, isOpen, isStruggling, onOpen, onClose, onPractice }: CardProps) {
  const { pattern, completed, bestWpm, bestAccuracy, sessionCount } = record;

  const borderClasses = completed
    ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/15 hover:border-green-400/50'
    : isStruggling
      ? 'border-yellow-500/40 bg-yellow-50/50 dark:bg-yellow-950/20 hover:border-yellow-400/70'
      : 'border-gray-300/40 dark:border-gray-700/40 bg-gray-100/50 dark:bg-gray-800/20 hover:border-gray-400/60 dark:hover:border-gray-600/60';

  const patternTextClass = completed
    ? 'text-green-600 dark:text-green-300'
    : isStruggling
      ? 'text-yellow-600 dark:text-yellow-300'
      : 'text-gray-700 dark:text-gray-300';

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
                <span className="text-yellow-500 dark:text-yellow-400 font-semibold">{bestWpm} wpm</span>
                <span className="text-gray-400 dark:text-gray-700">·</span>
                <span className="text-gray-500 dark:text-gray-400">{bestAccuracy}% acc</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-600">
                {sessionCount} session{sessionCount !== 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-600">no sessions yet</span>
          )}
        </div>

        <div className="w-full h-px bg-gray-200 dark:bg-gray-800" />

        <PracticePicker
          pattern={pattern}
          size="lg"
          tone={isStruggling ? 'yellow' : 'gray'}
          onPick={(mode, length) => onPractice(pattern, mode, length)}
          onCancel={onClose}
        />
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
        : isStruggling
          ? <span className="text-xs text-yellow-500/70 group-hover:text-yellow-400 transition-colors">struggling →</span>
          : <span className="text-xs text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">practice →</span>
      }
    </button>
  );
}

export function PatternWall({ library, onPractice, onReset }: Props) {
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const strugglingMap = loadStrugglingPatterns();

  const entries = Object.values(library).sort((a, b) => b.totalErrors - a.totalErrors);

  if (entries.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-32">
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">your pattern wall is empty</p>
        <p className="text-gray-400 dark:text-gray-600 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
          finish a typing test and your weak letter combinations will appear here
        </p>
      </div>
    );
  }

  const resetButton = confirmReset ? (
    <div className="flex flex-col items-center gap-3 mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
        this will erase all ngram timing, slow patterns, struggling data, and your pattern wall — are you sure?
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => { onReset(); setConfirmReset(false); }}
          className="px-5 py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
        >
          yes, reset everything
        </button>
        <button
          onClick={() => setConfirmReset(false)}
          className="px-5 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          cancel
        </button>
      </div>
    </div>
  ) : (
    <div className="flex justify-center mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
      <button
        onClick={() => setConfirmReset(true)}
        className="px-8 py-3 rounded-lg bg-red-600/15 border border-red-500/30 text-red-500 text-base font-semibold hover:bg-red-600/25 hover:border-red-500/60 hover:text-red-400 transition-all"
      >
        reset all data
      </button>
    </div>
  );

  const pending = entries.filter(e => !e.completed);
  const done = entries.filter(e => e.completed);

  const makeCardProps = (p: PatternRecord) => ({
    key: p.pattern,
    record: p,
    isOpen: activePattern === p.pattern,
    isStruggling: !p.completed && p.pattern in strugglingMap,
    onOpen: () => setActivePattern(p.pattern),
    onClose: () => setActivePattern(null),
    onPractice,
  });

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex items-center gap-6 mb-8 text-sm font-mono">
        <span className="text-gray-500">
          <span className="text-yellow-500 dark:text-yellow-400 font-semibold">{pending.length}</span> to practice
        </span>
        <span className="text-gray-300 dark:text-gray-700">·</span>
        <span className="text-gray-500">
          <span className="text-green-500 dark:text-green-400 font-semibold">{done.length}</span> mastered
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:divide-x divide-gray-200 dark:divide-gray-800">
        <section className="sm:pr-8 mb-8 sm:mb-0">
          <h2 className="text-[11px] text-gray-400 dark:text-gray-600 font-medium uppercase tracking-[0.2em] mb-4">
            needs practice
          </h2>
          {pending.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {pending.map(p => <PatternCard {...makeCardProps(p)} />)}
            </div>
          ) : (
            <p className="text-gray-400 dark:text-gray-700 text-sm">nothing here yet</p>
          )}
        </section>

        <section className="sm:pl-8">
          <h2 className="text-[11px] text-gray-400 dark:text-gray-600 font-medium uppercase tracking-[0.2em] mb-4">
            mastered
          </h2>
          {done.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {done.map(p => <PatternCard {...makeCardProps(p)} />)}
            </div>
          ) : (
            <p className="text-gray-400 dark:text-gray-700 text-sm">complete a practice session to master patterns</p>
          )}
        </section>
      </div>

      {resetButton}
    </div>
  );
}
