import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Layout/Header';
import { TypingArea } from './components/TypingTest/TypingArea';
import { ResultsScreen } from './components/Results/ResultsScreen';
import { PatternWall } from './components/PatternWall/PatternWall';
import { useTypingEngine } from './hooks/useTypingEngine';
import { usePatternLibrary } from './hooks/usePatternLibrary';
import type { TimedMode } from './types';

export default function App() {
  const { state, handleKeyDown, reset, changeDuration, startFocusedSession } = useTypingEngine();
  const { library, addFromSession, markCompleted } = usePatternLibrary();
  const [view, setView] = useState<'typing' | 'wall'>('typing');

  // Tab + Enter to restart
  useEffect(() => {
    let tabHeld = false;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { e.preventDefault(); tabHeld = true; }
      if (e.key === 'Enter' && tabHeld) reset();
    };
    const up = (e: KeyboardEvent) => { if (e.key === 'Tab') tabHeld = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [reset]);

  // On test finish: save patterns, mark focused session complete
  const prevTestStateRef = useRef(state.testState);
  useEffect(() => {
    if (prevTestStateRef.current !== 'finished' && state.testState === 'finished' && state.results) {
      addFromSession(state.results.ngramMistakes, state.results.ngramGraduated);
      if (state.focusedPattern) markCompleted(state.focusedPattern);
    }
    prevTestStateRef.current = state.testState;
  }, [state.testState, state.results, state.focusedPattern, addFromSession, markCompleted]);

  const handlePracticePattern = useCallback((pattern: string, duration: TimedMode) => {
    startFocusedSession(pattern, duration);
    setView('typing');
  }, [startFocusedSession]);

  const handleRestart = useCallback(() => reset(), [reset]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Header view={view} onToggleView={() => setView(v => v === 'typing' ? 'wall' : 'typing')} />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {view === 'wall' ? (
          <PatternWall library={library} onPractice={handlePracticePattern} />
        ) : state.testState === 'finished' && state.results ? (
          <ResultsScreen
            results={state.results}
            onRestart={handleRestart}
            onPracticePattern={handlePracticePattern}
          />
        ) : (
          <TypingArea
            testState={state.testState}
            timeLeft={state.timeLeft}
            duration={state.duration}
            line={state.line}
            currentWord={state.currentWord}
            currentChar={state.currentChar}
            ngrams={state.ngrams}
            ngramStreaks={state.ngramStreaks}
            difficultyLevel={state.difficultyLevel}
            focusedPattern={state.focusedPattern}
            onKeyDown={handleKeyDown}
            onChangeDuration={changeDuration}
          />
        )}
      </main>

      <footer className="text-center py-4 text-gray-700 text-xs">
        tab + enter to restart
      </footer>
    </div>
  );
}
