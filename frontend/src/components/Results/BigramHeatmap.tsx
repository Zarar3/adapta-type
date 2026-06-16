import { useState } from 'react';
import { loadStoredTiming, loadStrugglingPatterns } from '../../lib/ngramTracker';
import type { TimedMode } from '../../types';

const MODES: TimedMode[] = [15, 30, 60, 120];

interface WeakSpot {
  ng: string;
  reason: 'slow' | 'error' | 'both';
}

interface Props {
  onPracticePattern: (pattern: string, duration: TimedMode) => void;
}

export function BigramHeatmap({ onPracticePattern }: Props) {
  const [pickingPattern, setPickingPattern] = useState<string | null>(null);

  const timing = loadStoredTiming();
  const struggling = loadStrugglingPatterns();

  const entries = Object.entries(timing).filter(([, t]) => t.count >= 3);
  const totalMs = entries.reduce((s, [, t]) => s + t.totalMs, 0);
  const totalCount = entries.reduce((s, [, t]) => s + t.count, 0);
  const overallAvg = totalCount > 0 ? totalMs / totalCount : 1;

  const slowSet = new Set(
    entries
      .map(([ng, t]) => ({ ng, ratio: (t.totalMs / t.count) / overallAvg }))
      .filter(({ ratio }) => ratio >= 1.3)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5)
      .map(({ ng }) => ng)
  );

  const errorSet = new Set(
    Object.entries(struggling)
      .sort(([, a], [, b]) => b.rate - a.rate)
      .slice(0, 5)
      .map(([ng]) => ng)
  );

  const allPatterns = new Set([...slowSet, ...errorSet]);
  if (allPatterns.size === 0) return null;

  const spots: WeakSpot[] = [...allPatterns].map(ng => ({
    ng,
    reason: slowSet.has(ng) && errorSet.has(ng) ? 'both' : slowSet.has(ng) ? 'slow' : 'error',
  }));

  const label = (reason: WeakSpot['reason']) => {
    if (reason === 'both') return 'slow and often mistyped';
    if (reason === 'slow') return 'takes you longer to type';
    return 'you often mistype this';
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 sm:p-6 mb-8">
      <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4">
        weak spots <span className="text-gray-400 dark:text-gray-600 font-normal">(all time)</span>
      </h3>

      <div className="space-y-2">
        {spots.map(({ ng, reason }) => (
          <div key={ng}>
            {pickingPattern === ng ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-yellow-400/15 border border-yellow-400/40 flex-wrap">
                <span className="font-mono text-yellow-300 text-sm">{ng}</span>
                <span className="text-gray-400 dark:text-gray-600 text-xs mx-1">→</span>
                {MODES.map(m => (
                  <button
                    key={m}
                    onClick={() => { onPracticePattern(ng, m); setPickingPattern(null); }}
                    className="px-2 py-0.5 rounded text-xs font-mono bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-yellow-400 hover:text-gray-900 transition-colors"
                  >
                    {m}s
                  </button>
                ))}
                <button onClick={() => setPickingPattern(null)} className="text-xs text-gray-400 dark:text-gray-700 hover:text-gray-500 ml-1">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPickingPattern(ng)}
                  className="px-3 py-1.5 rounded font-mono text-sm bg-yellow-400/10 border border-yellow-400/20 text-yellow-300 hover:bg-yellow-400/25 hover:border-yellow-400/40 transition-colors shrink-0"
                >
                  {ng}
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-600">{label(reason)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-700 ml-auto hidden sm:block">click to practice</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
