import { useState } from 'react';
import type { PatternRecord } from '../../hooks/usePatternLibrary';
import type { TimedMode } from '../../types';

interface Props {
  library: Record<string, PatternRecord>;
  onPractice: (pattern: string, duration: TimedMode) => void;
}

const MODES: TimedMode[] = [15, 30, 60, 120];

function PatternCard({ record, onPractice }: { record: PatternRecord; onPractice: (pattern: string, duration: TimedMode) => void }) {
  const [picking, setPicking] = useState(false);
  const { pattern, totalErrors, completed } = record;

  if (picking) {
    return (
      <div className={`flex flex-col items-center gap-2 px-5 py-4 rounded-lg border ${completed ? 'bg-green-400/5 border-green-400/30' : 'bg-gray-900 border-yellow-400/30'}`}>
        <span className={`font-mono text-2xl tracking-widest ${completed ? 'text-green-300' : 'text-gray-200'}`}>{pattern}</span>
        <p className="text-xs text-gray-500">choose duration</p>
        <div className="flex gap-1.5">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => onPractice(pattern, m)}
              className="px-3 py-1 rounded text-sm font-mono bg-gray-800 text-gray-300 hover:bg-yellow-400 hover:text-gray-900 transition-colors"
            >
              {m}s
            </button>
          ))}
        </div>
        <button onClick={() => setPicking(false)} className="text-xs text-gray-700 hover:text-gray-500 mt-1">cancel</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setPicking(true)}
      className={`flex flex-col items-center gap-1.5 px-5 py-4 rounded-lg border transition-colors group ${
        completed
          ? 'bg-green-400/5 border-green-400/20 hover:border-green-400/40'
          : 'bg-gray-900 border-gray-800 hover:border-yellow-400/40 hover:bg-gray-800'
      }`}
    >
      <span className={`font-mono text-2xl tracking-widest ${completed ? 'text-green-300' : 'text-gray-200'}`}>{pattern}</span>
      {totalErrors > 0 && <span className="text-xs text-red-400">×{totalErrors} errors</span>}
      {completed
        ? <span className="text-xs text-green-600">✓ done</span>
        : <span className="text-xs text-gray-700 group-hover:text-gray-500 transition-colors">practice</span>
      }
    </button>
  );
}

export function PatternWall({ library, onPractice }: Props) {
  const entries = Object.values(library).sort((a, b) => b.totalErrors - a.totalErrors);

  if (entries.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-24">
        <p className="text-gray-600 text-lg">no patterns yet</p>
        <p className="text-gray-700 text-sm mt-2">complete a typing test to start building your wall</p>
      </div>
    );
  }

  const pending = entries.filter(e => !e.completed);
  const done = entries.filter(e => e.completed);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {pending.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-5">needs practice</h2>
          <div className="flex flex-wrap gap-3">
            {pending.map(p => <PatternCard key={p.pattern} record={p} onPractice={onPractice} />)}
          </div>
        </section>
      )}
      {done.length > 0 && (
        <section>
          <h2 className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-5">completed</h2>
          <div className="flex flex-wrap gap-3">
            {done.map(p => <PatternCard key={p.pattern} record={p} onPractice={onPractice} />)}
          </div>
        </section>
      )}
    </div>
  );
}
