import { loadStoredTiming, loadStrugglingPatterns } from '../../lib/ngramTracker';

interface TimingBar { ng: string; avgMs: number; ratio: number; }
interface ErrorBar  { ng: string; rate: number; practiceCount: number; }

export function BigramHeatmap() {
  const timing = loadStoredTiming();
  const struggling = loadStrugglingPatterns();

  const entries = Object.entries(timing).filter(([, t]) => t.count >= 3);
  const totalMs = entries.reduce((s, [, t]) => s + t.totalMs, 0);
  const totalCount = entries.reduce((s, [, t]) => s + t.count, 0);
  const overallAvg = totalCount > 0 ? totalMs / totalCount : 1;

  const timingBars: TimingBar[] = entries
    .map(([ng, t]) => ({ ng, avgMs: t.totalMs / t.count, ratio: (t.totalMs / t.count) / overallAvg }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);

  const errorBars: ErrorBar[] = Object.entries(struggling)
    .map(([ng, e]) => ({ ng, rate: e.rate, practiceCount: e.practiceCount }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);

  if (timingBars.length === 0 && errorBars.length === 0) return null;

  const barColor = (ratio: number) =>
    ratio >= 2.0 ? '#f87171'
    : ratio >= 1.5 ? '#fb923c'
    : ratio >= 1.0 ? '#facc15'
    : '#4ade80';

  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 sm:p-6 mb-8">
      <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4">bigram profile</h3>

      {timingBars.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">slowest sequences (vs your average)</p>
          <div className="space-y-1.5">
            {timingBars.map(({ ng, ratio }) => (
              <div key={ng} className="flex items-center gap-3">
                <span className="font-mono text-sm w-8 text-gray-600 dark:text-gray-400 text-right">{ng}</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(ratio / 3, 1) * 100}%`,
                      backgroundColor: barColor(ratio),
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 w-10 text-right">{ratio.toFixed(1)}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {errorBars.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">highest error rates</p>
          <div className="space-y-1.5">
            {errorBars.map(({ ng, rate }) => (
              <div key={ng} className="flex items-center gap-3">
                <span className="font-mono text-sm w-8 text-gray-600 dark:text-gray-400 text-right">{ng}</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-red-400 transition-all"
                    style={{ width: `${Math.min(rate, 1) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 w-10 text-right">{Math.round(rate * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
