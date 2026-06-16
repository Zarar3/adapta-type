import { useState } from 'react';
import { StatsBar } from './StatsBar';
import { WpmGraph } from './WpmGraph';
import { BigramHeatmap } from './BigramHeatmap';
import { getSlowPatterns, getSessionCount, loadStrugglingPatterns, loadSurviveBest } from '../../lib/ngramTracker';
import { shareCard, downloadShareCard } from '../../lib/export';
import { PracticePicker } from '../PracticePicker';
import type { TestResults, GameMode } from '../../types';

interface Props {
  results: TestResults;
  focusedPattern: string | null;
  onRestart: () => void;
  onPracticePattern: (pattern: string, mode: GameMode, length?: number) => void;
}

export function ResultsScreen({ results, focusedPattern, onRestart, onPracticePattern }: Props) {
  const [pickingPattern, setPickingPattern] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const openShare = () => shareCard(results).then(url => { if (url) setShareUrl(url); });
  const closeShare = () => { if (shareUrl) URL.revokeObjectURL(shareUrl); setShareUrl(null); };
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
      {results.quote && (
        <div className="flex justify-center mb-4">
          <p className="text-xs text-gray-500 font-mono text-center">
            "{results.quote.text.slice(0, 60)}{results.quote.text.length > 60 ? '…' : ''}"
            <br />
            <span className="text-gray-600">— {results.quote.author}</span>
          </p>
        </div>
      )}

      {results.surviveScore != null && (
        <div className="text-center mb-6">
          <p className="text-4xl font-mono font-bold text-yellow-400">{results.surviveScore}</p>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            {results.surviveGoldenCount ?? 0} golden · {results.surviveMaxCombo ?? 0} max combo
          </p>
          {results.surviveScore > 0 && loadSurviveBest() === results.surviveScore && (
            <p className="text-xs text-yellow-400 font-mono mt-1">new personal best!</p>
          )}
        </div>
      )}

      <StatsBar
        wpm={results.wpm}
        rawWpm={results.rawWpm}
        accuracy={results.accuracy}
        duration={results.duration}
      />

      <div className="flex justify-center gap-4 sm:gap-8 mb-4 text-sm font-mono text-gray-500 flex-wrap">
        <span>peak <span className="text-gray-700 dark:text-gray-200">{results.peakWpm}</span> wpm</span>
        <span>best streak <span className="text-gray-700 dark:text-gray-200">{results.longestPerfectStreak}</span></span>
        <span>cleared <span className="text-green-400">{Object.keys(results.ngramGraduated).length}</span></span>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 sm:p-6 mb-8">
        <WpmGraph data={results.wpmHistory} duration={results.duration} difficultyHistory={results.difficultyHistory} />
      </div>

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
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 sm:p-6 mb-8">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4">pattern breakdown</h3>

            {!hasAnything && remaining > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-600">
                complete {remaining} more test{remaining === 1 ? '' : 's'} to start building your timing profile
              </p>
            )}

            {slowThisRun.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 dark:text-gray-600 mb-2">slow this run <span className="text-gray-300 dark:text-gray-700">— click to practice</span></p>
                <div className="flex flex-wrap gap-2">
                  {slowThisRun.map(({ ng, improved }) => (
                    <div key={ng}>
                      {pickingPattern === ng ? (
                        <div className="px-2.5 py-1.5 rounded bg-yellow-400/15 border border-yellow-400/40">
                          <PracticePicker
                            pattern={ng}
                            tone="yellow"
                            onPick={(mode, length) => { onPracticePattern(ng, mode, length); setPickingPattern(null); }}
                            onCancel={() => setPickingPattern(null)}
                          />
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
                <p className="text-xs text-gray-400 dark:text-gray-600 mb-2">still struggling <span className="text-gray-300 dark:text-gray-700">— click to practice</span></p>
                <div className="flex flex-wrap gap-2">
                  {struggled.map((ng) => (
                    <div key={ng}>
                      {pickingPattern === ng ? (
                        <div className="px-2.5 py-1.5 rounded bg-red-500/20 border border-red-500/50">
                          <PracticePicker
                            pattern={ng}
                            tone="red"
                            onPick={(mode, length) => { onPracticePattern(ng, mode, length); setPickingPattern(null); }}
                            onCancel={() => setPickingPattern(null)}
                          />
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
                <p className="text-xs text-gray-400 dark:text-gray-600 mb-2">cleared</p>
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

      {sessionCount >= 3 && <BigramHeatmap onPracticePattern={onPracticePattern} />}

      {focusedPattern && (
        <div className="flex justify-center mb-4">
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?challenge=${focusedPattern}`;
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="text-xs text-gray-500 hover:text-yellow-400 font-mono transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? 'copied!' : `challenge a friend with "${focusedPattern}"`}
          </button>
        </div>
      )}

      <div className="flex justify-center gap-3">
        <button
          onClick={openShare}
          className="flex items-center gap-2 px-4 py-2.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
          title="share result"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          share
        </button>
        <button
          onClick={onRestart}
          className="flex items-center gap-2 px-6 py-2.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white transition-colors font-medium"
          title="Tab + Enter to restart"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          restart
        </button>
      </div>

      {shareUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeShare}
        >
          <div
            className="flex flex-col items-center gap-4 max-w-3xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={shareUrl}
              alt="share card preview"
              className="w-full rounded-lg shadow-2xl"
            />
            <div className="flex gap-3">
              <button
                onClick={() => downloadShareCard(shareUrl, results.wpm)}
                className="px-4 py-2 rounded bg-yellow-400 text-gray-900 text-sm font-medium hover:bg-yellow-300 transition-colors"
              >
                download
              </button>
              <button
                onClick={closeShare}
                className="px-4 py-2 rounded bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
