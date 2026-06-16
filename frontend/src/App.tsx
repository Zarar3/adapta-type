import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Layout/Header';
import { TypingArea } from './components/TypingTest/TypingArea';
import { ResultsScreen } from './components/Results/ResultsScreen';
import { PatternWall } from './components/PatternWall/PatternWall';
import { RaceRoom } from './components/Race/RaceRoom';
import { useTypingEngine } from './hooks/useTypingEngine';
import { usePatternLibrary } from './hooks/usePatternLibrary';
import { useSound } from './hooks/useSound';
import { QUOTES } from './data/quotes';
import type { TimedMode, GameMode, WordCountTarget } from './types';

export default function App() {
  const [view, setView] = useState<'typing' | 'wall' | 'race'>('typing');
  const [raceStarted, setRaceStarted] = useState(false);
  const { state, handleKeyDown, reset, changeDuration, startFocusedSession, endTest,
          startWordCountSession, startQuoteSession, startCustomSession } = useTypingEngine(view === 'race' && raceStarted);
  const { library, addFromSession, markCompleted, recordFocusedSession } = usePatternLibrary();
  const { enabled: soundEnabled, toggle: toggleSound, playCorrect, playWrong } = useSound();
  const [gameMode, setGameMode] = useState<GameMode>('timed');
  const [wordTarget, setWordTarget] = useState<WordCountTarget>(25);
  const [customText, setCustomText] = useState('');
  const [raceRoomId, setRaceRoomId] = useState<string | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('adapta-type-theme') as 'dark' | 'light') ?? 'dark'
  );
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('adapta-type-theme', next);
      return next;
    });
  }, []);

  const goHome = useCallback(() => { reset(); setView('typing'); }, [reset]);

  const pickRandomQuote = useCallback(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  const handleChangeMode = useCallback((m: GameMode) => {
    setGameMode(m);
    setView('typing');
    if (m === 'quote') {
      startQuoteSession(pickRandomQuote());
    } else if (m === 'words') {
      startWordCountSession(wordTarget);
    } else {
      reset();
    }
  }, [reset, startQuoteSession, startWordCountSession, wordTarget, pickRandomQuote]);

  const handleChangeWordTarget = useCallback((t: WordCountTarget) => {
    setWordTarget(t);
    startWordCountSession(t);
  }, [startWordCountSession]);

  const handleStartCustom = useCallback(() => {
    startCustomSession(customText);
  }, [startCustomSession, customText]);

  const handleRestart = useCallback(() => {
    setView('typing');
    if (gameMode === 'quote') {
      startQuoteSession(pickRandomQuote());
    } else if (gameMode === 'words') {
      startWordCountSession(wordTarget);
    } else {
      reset();
    }
  }, [gameMode, wordTarget, reset, startQuoteSession, startWordCountSession, pickRandomQuote]);

  // Read URL params on mount (?challenge= and ?room=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const room = params.get('room');
    if (room) {
      setRaceRoomId(room);
      setView('race');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const challenge = params.get('challenge');
    if (challenge && challenge.length >= 2 && challenge.length <= 3) {
      import('./lib/wordSelector').then(({ hasSufficientCoverage }) => {
        if (hasSufficientCoverage(challenge)) {
          startFocusedSession(challenge, 30);
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = useCallback(() => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    setRaceRoomId(code);
    setView('race');
  }, []);

  // Tab + Enter to restart from anywhere
  useEffect(() => {
    let tabHeld = false;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { e.preventDefault(); tabHeld = true; }
      if (e.key === 'Enter' && tabHeld) {
        setView('typing');
        if (gameMode === 'quote') {
          startQuoteSession(pickRandomQuote());
        } else if (gameMode === 'words') {
          startWordCountSession(wordTarget);
        } else {
          goHome();
        }
      }
    };
    const up = (e: KeyboardEvent) => { if (e.key === 'Tab') tabHeld = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [goHome, gameMode, wordTarget, startQuoteSession, startWordCountSession, pickRandomQuote]);

  // On test finish: save patterns, mark focused session complete
  const prevTestStateRef = useRef(state.testState);
  useEffect(() => {
    if (prevTestStateRef.current !== 'finished' && state.testState === 'finished' && state.results) {
      addFromSession(state.results.ngramMistakes, state.results.ngramGraduated);
      if (state.focusedPattern) {
        markCompleted(state.focusedPattern);
        recordFocusedSession(state.focusedPattern, state.results.wpm, state.results.accuracy);
      }
    }
    prevTestStateRef.current = state.testState;
  }, [state.testState, state.results, state.focusedPattern, addFromSession, markCompleted, recordFocusedSession]);

  const handlePracticePattern = useCallback((pattern: string, duration: TimedMode) => {
    startFocusedSession(pattern, duration);
    setView('typing');
  }, [startFocusedSession]);

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <Header
        view={view}
        onToggleView={() => setView(v => v === 'typing' ? 'wall' : 'typing')}
        onLogoClick={goHome}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        theme={theme}
        onToggleTheme={toggleTheme}
        onCreateRoom={createRoom}
      />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-12">
        {view === 'race' && raceRoomId ? (
          <div className="w-full flex flex-col items-center gap-8">
            <RaceRoom
              roomId={raceRoomId}
              onStart={() => { startWordCountSession(50); setRaceStarted(true); }}
              wordsCompleted={state.wordsCompleted}
              currentWpm={state.wpmHistory.length > 0 ? state.wpmHistory[state.wpmHistory.length - 1].wpm : 0}
              isFinished={state.testState === 'finished'}
              onLeave={() => { setView('typing'); setRaceRoomId(null); setRaceStarted(false); reset(); }}
            />
            {raceStarted && state.testState !== 'finished' && (
              <TypingArea
                testState={state.testState}
                timeLeft={state.timeLeft}
                duration={state.duration}
                gameMode={gameMode}
                wordTarget={wordTarget}
                wordsCompleted={state.wordsCompleted}
                currentQuote={state.currentQuote}
                customText={customText}
                line={state.line}
                currentWord={state.currentWord}
                currentChar={state.currentChar}
                ngramDisplayOrder={state.ngramDisplayOrder}
                ngramStreaks={state.ngramStreaks}
                difficultyLevel={state.difficultyLevel}
                focusedPattern={state.focusedPattern}
                showLineHint={state.showLineHint}
                correctChars={state.correctChars}
                totalChars={state.totalChars}
                onKeyDown={handleKeyDown}
                onChangeDuration={changeDuration}
                onChangeMode={handleChangeMode}
                onChangeWordTarget={handleChangeWordTarget}
                onChangeCustomText={setCustomText}
                onStartCustom={handleStartCustom}
                onRestart={handleRestart}
                onEndTest={endTest}
                playCorrect={playCorrect}
                playWrong={playWrong}
                spaceBlocked={state.spaceBlocked}
              />
            )}
            {raceStarted && state.testState === 'finished' && state.results && (
              <ResultsScreen
                results={state.results}
                focusedPattern={state.focusedPattern}
                onRestart={handleRestart}
                onPracticePattern={handlePracticePattern}
              />
            )}
          </div>
        ) : view === 'wall' ? (
          <PatternWall library={library} onPractice={handlePracticePattern} />
        ) : state.testState === 'finished' && state.results ? (
          <ResultsScreen
            results={state.results}
            focusedPattern={state.focusedPattern}
            onRestart={handleRestart}
            onPracticePattern={handlePracticePattern}
          />
        ) : (
          <TypingArea
            testState={state.testState}
            timeLeft={state.timeLeft}
            duration={state.duration}
            gameMode={gameMode}
            wordTarget={wordTarget}
            wordsCompleted={state.wordsCompleted}
            currentQuote={state.currentQuote}
            customText={customText}
            line={state.line}
            currentWord={state.currentWord}
            currentChar={state.currentChar}
            ngramDisplayOrder={state.ngramDisplayOrder}
            ngramStreaks={state.ngramStreaks}
            difficultyLevel={state.difficultyLevel}
            focusedPattern={state.focusedPattern}
            showLineHint={state.showLineHint}
            correctChars={state.correctChars}
            totalChars={state.totalChars}
            onKeyDown={handleKeyDown}
            onChangeDuration={changeDuration}
            onChangeMode={handleChangeMode}
            onChangeWordTarget={handleChangeWordTarget}
            onChangeCustomText={setCustomText}
            onStartCustom={handleStartCustom}
            onRestart={handleRestart}
            onEndTest={endTest}
            playCorrect={playCorrect}
            playWrong={playWrong}
          />
        )}
      </main>

      <footer className="text-center py-4 text-gray-400 dark:text-gray-700 text-s">
        tab + enter to restart
      </footer>
    </div>
  );
}
