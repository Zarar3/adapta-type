export type CharState = 'untyped' | 'correct' | 'incorrect' | 'extra';

export interface WpmDataPoint {
  t: number;
  wpm: number;
  raw: number;
  errors: number;
}

export interface DifficultyChange {
  t: number;
  level: number;
}

export type GameMode = 'timed' | 'words' | 'quote' | 'custom';
export type WordCountTarget = 10 | 25 | 50 | 100;

export interface Quote {
  text: string;
  author: string;
  source?: string;
}

export interface TestResults {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;        // elapsed seconds (for infinite: actual elapsed, otherwise mode duration)
  peakWpm: number;
  longestPerfectStreak: number;
  wpmHistory: WpmDataPoint[];
  ngramMistakes: Record<string, number>;
  ngramFocused: string[];              // error-promoted patterns still active at test end
  preRunSlowKeys: string[];            // flagged-slow keys captured before this run's timing was merged
  ngramGraduated: Record<string, number>;
  difficultyHistory: DifficultyChange[];
  quote?: Quote;
}

export type TestState = 'idle' | 'running' | 'finished';
export type TimedMode = 15 | 30 | 60 | 120 | 'infinite';
