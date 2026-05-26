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
  slowThisRun: string[];               // bigrams identified as slow from this run's timing data
  ngramGraduated: Record<string, number>;
  difficultyHistory: DifficultyChange[];
}

export type TestState = 'idle' | 'running' | 'finished';
export type TimedMode = 15 | 30 | 60 | 120 | 'infinite';
