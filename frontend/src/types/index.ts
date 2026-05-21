export type CharState = 'untyped' | 'correct' | 'incorrect' | 'extra';

export interface WpmDataPoint {
  t: number;
  wpm: number;
  raw: number;
  errors: number;
}

export interface TestResults {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;
  wpmHistory: WpmDataPoint[];
  ngramMistakes: Record<string, number>;  // patterns still unresolved at test end
  ngramGraduated: Record<string, number>; // patterns the user cleared during the test
}

export type TestState = 'idle' | 'running' | 'finished';
export type TimedMode = 15 | 30 | 60 | 120;
