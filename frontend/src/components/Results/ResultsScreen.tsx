import { StatsBar } from './StatsBar';
import { WpmGraph } from './WpmGraph';
import type { TestResults } from '../../types';

interface Props {
  results: TestResults;
  onRestart: () => void;
}

export function ResultsScreen({ results, onRestart }: Props) {
  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      <StatsBar
        wpm={results.wpm}
        rawWpm={results.rawWpm}
        accuracy={results.accuracy}
        duration={results.duration}
      />

      <div className="bg-gray-900 rounded-lg p-6 mb-8">
        <WpmGraph data={results.wpmHistory} duration={results.duration} />
      </div>

      {/* Struggled patterns */}
      {(() => {
        const struggled = Object.entries(results.ngramMistakes).sort(([, a], [, b]) => b - a);
        const cleared = Object.keys(results.ngramGraduated);
        if (struggled.length === 0 && cleared.length === 0) return null;
        return (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h3 className="text-gray-400 text-sm font-medium mb-4">pattern breakdown</h3>
            {struggled.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2">still struggling</p>
                <div className="flex flex-wrap gap-2">
                  {struggled.map(([ng, count]) => (
                    <div key={ng} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-400/10 border border-red-400/20">
                      <span className="font-mono text-red-300 text-sm">{ng}</span>
                      <span className="text-red-500 text-xs">×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {cleared.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 mb-2">cleared</p>
                <div className="flex flex-wrap gap-2">
                  {cleared.map(ng => (
                    <div key={ng} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-400/10 border border-green-400/20">
                      <span className="font-mono text-green-300 text-sm">{ng}</span>
                      <span className="text-green-500 text-xs">✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="flex justify-center">
        <button
          onClick={onRestart}
          className="flex items-center gap-2 px-6 py-2.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors font-medium"
          title="Tab + Enter to restart"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          restart
        </button>
      </div>
    </div>
  );
}
