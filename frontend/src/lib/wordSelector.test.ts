import { describe, it, expect } from 'vitest';
import { generateLine } from './wordSelector';

describe('generateLine', () => {
  it('returns the requested number of words', () => {
    expect(generateLine({}, 8)).toHaveLength(8);
    expect(generateLine({}, 12)).toHaveLength(12);
  });

  it('returns words of 3-5 chars at difficulty 1 (default)', () => {
    const words = generateLine({}, 20, 1);
    words.forEach(w => {
      expect(w.length).toBeGreaterThanOrEqual(3);
      expect(w.length).toBeLessThanOrEqual(5);
    });
  });

  it('returns longer words at difficulty 4', () => {
    const words = generateLine({}, 10, 4);
    const avgLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    expect(avgLen).toBeGreaterThan(5); // difficulty 4 range is 6-14
  });

  it('all words contain the pattern when ngrams are set', () => {
    const words = generateLine({ th: 3 }, 8);
    const allHavePattern = words.every(w => w.includes('th'));
    expect(allHavePattern).toBe(true);
  });

  it('returns strings (not undefined or empty)', () => {
    const words = generateLine({}, 6);
    words.forEach(w => {
      expect(typeof w).toBe('string');
      expect(w.length).toBeGreaterThan(0);
    });
  });
});
