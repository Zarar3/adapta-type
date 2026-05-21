export const calcWpm = (correctChars: number, elapsedMs: number): number => {
  if (elapsedMs <= 0) return 0;
  return Math.round((correctChars / 5) / (elapsedMs / 60000));
};

export const calcRawWpm = (totalChars: number, elapsedMs: number): number => {
  if (elapsedMs <= 0) return 0;
  return Math.round((totalChars / 5) / (elapsedMs / 60000));
};

export const calcAccuracy = (correct: number, total: number): number => {
  if (total === 0) return 100;
  return Math.round((correct / total) * 10000) / 100;
};
