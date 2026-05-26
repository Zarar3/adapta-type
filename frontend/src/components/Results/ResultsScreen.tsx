import { useState } from 'react';
import { StatsBar } from './StatsBar';
import { WpmGraph } from './WpmGraph';
import { getSlowPatterns, getSessionCount, loadStrugglingPatterns } from '../../lib/ngramTracker';
import type { TestResults, TimedMode } from '../../types';

const MODES: TimedMode[] = [15, 30, 60, 120];

interface Props {
  results: TestResults;
  focusedPattern: string | null;
  onRestart: () => void;
  onPracticePattern: (pattern: string, duration: TimedMode) => void;
}

export function ResultsScreen({ results, focusedPattern, onRestart, onPracticePattern }: Props) {
  const [pickingPattern, setPickingPattern] = useState<string | null>(null);
  const sessionCount = getSessionCount();
  const MIN_SESSIONS = 3;

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      {focusedPattern && (
        <div className="flex justify-center mb-4">
          <span className="text-xs text-gray-500 font-mono">
            practiced <span className="text-yellow-300 font-semibold">{focusedPattern}</span>
          </span>
        </div>
      )}
      <StatsBar
        wpm={results.wpm}
        rawWpm={results.rawWpm}
        accuracy={results.accuracy}
        duration={results.duration}
      />

      <div className="flex justify-center gap-8 mb-4 text-sm font-mono text-gray-500">
        <span>peak <span className="text-gray-200">{results.peakWpm}</span> wpm</span>
        <span>best streak <span className="text-gray-200">{results.longestPerfectStreak}</span></span>
        <span>cleared <span className="text-green-400">{Object.keys(results.ngramGraduated).length}</span></span>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 mb-8">
        <WpmGraph data={results.wpmHistory} duration={results.duration} difficultyHistory={results.difficultyHistory} />
      </div>

      {/* Pattern wall */}
      {(() => {
        const preRunSet = new Set(results.preRunSlowKeys);
        const slowThisRun = getSlowPatterns().filter(p => !preRunSet.has(p.ng));
        const strugglingMap = loadStrugglingPatterns();
        const focusedSet = new Set(results.ngramFocused);
        const struggled = Object.keys(strugglingMap).filter(ng => focusedSet.has(ng));
        const cleared = Object.keys(results.ngramGraduated);
        const hasAnything = slowThisRun.length > 0 || struggled.length > 0 || cleared.length > 0;

        const remaining = Math.max(0, MIN_SESSIONS - sessionCount);

        return (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h3 className="text-gray-400 text-sm font-medium mb-4">pattern breakdown</h3>

            {!hasAnything && remaining > 0 && (
              <p className="text-xs text-gray-600">
                complete {remaining} more test{remaining === 1 ? '' : 's'} to start building your timing profile
              </p>
            )}

            {slowThisRun.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2">slow this run <span className="text-gray-700">— click to practice</span></p>
                <div className="flex flex-wrap gap-2">
                  {slowThisRun.map(({ ng, improved }) => (
                    <div key={ng}>
                      {pickingPattern === ng ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-yellow-400/15 border border-yellow-400/40">
                          <span className="font-mono text-yellow-300 text-sm">{ng}</span>
                          <span className="text-gray-600 text-xs mx-1">→</span>
                          {MODES.map(m => (
                            <button key={m} onClick={() => onPracticePattern(ng, m)}
                              className="px-2 py-0.5 rounded text-xs font-mono bg-gray-800 text-gray-300 hover:bg-yellow-400 hover:text-gray-900 transition-colors">
                              {m}s
                            </button>
                          ))}
                          <button onClick={() => setPickingPattern(null)} className="text-xs text-gray-700 hover:text-gray-500 ml-1">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPickingPattern(ng)}
                          className={`px-3 py-1.5 rounded font-mono text-sm transition-colors ${
                            improved
                              ? 'bg-green-400/10 border border-green-400/20 text-green-300 hover:bg-green-400/20 hover:border-green-400/40'
                              : 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-300 hover:bg-yellow-400/25 hover:border-yellow-400/40'
                          }`}
                        >
                          {ng}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {struggled.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2">still struggling <span className="text-gray-700">— click to practice</span></p>
                <div className="flex flex-wrap gap-2">
                  {struggled.map((ng) => (
                    <div key={ng}>
                      {pickingPattern === ng ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-500/20 border border-red-500/50">
                          <span className="font-mono text-red-400 text-sm">{ng}</span>
                          <span className="text-gray-600 text-xs mx-1">→</span>
                          {MODES.map(m => (
                            <button key={m} onClick={() => onPracticePattern(ng, m)}
                              className="px-2 py-0.5 rounded text-xs font-mono bg-gray-800 text-gray-300 hover:bg-yellow-400 hover:text-gray-900 transition-colors">
                              {m}s
                            </button>
                          ))}
                          <button onClick={() => setPickingPattern(null)} className="text-xs text-gray-700 hover:text-gray-500 ml-1">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPickingPattern(ng)}
                          className="px-3 py-1.5 rounded font-mono text-sm bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/35 hover:border-red-500/60 transition-colors"
                        >
                          {ng}
                        </button>
                      )}
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
                    <div key={ng} className="px-3 py-1.5 rounded font-mono text-sm bg-green-400/10 border border-green-400/20 text-green-300">
                      {ng}
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
