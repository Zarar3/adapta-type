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
  duration: number;
  wpmHistory: WpmDataPoint[];
  ngramMistakes: Record<string, number>;
  ngramGraduated: Record<string, number>;
  difficultyHistory: DifficultyChange[];
}

export type TestState = 'idle' | 'running' | 'finished';
export type TimedMode = 15 | 30 | 60 | 120;
