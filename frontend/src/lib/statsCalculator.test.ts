import { describe, it, expect } from 'vitest';
import { calcWpm, calcRawWpm, calcAccuracy } from './statsCalculator';

describe('calcWpm', () => {
  it('returns 60 for 300 correct chars in 60s', () => {
    expect(calcWpm(300, 60_000)).toBe(60);
  });
  it('returns 0 for 0 chars', () => {
    expect(calcWpm(0, 60_000)).toBe(0);
  });
  it('returns 120 for 600 chars in 60s', () => {
    expect(calcWpm(600, 60_000)).toBe(120);
  });
});

describe('calcRawWpm', () => {
  it('returns 60 for 300 total chars in 60s', () => {
    expect(calcRawWpm(300, 60_000)).toBe(60);
  });
  it('returns 0 for 0 chars', () => {
    expect(calcRawWpm(0, 60_000)).toBe(0);
  });
});

describe('calcAccuracy', () => {
  it('returns 100 when total is 0', () => {
    expect(calcAccuracy(0, 0)).toBe(100);
  });
  it('returns 100 when all chars correct', () => {
    expect(calcAccuracy(10, 10)).toBe(100);
  });
  it('returns 50 for half correct', () => {
    expect(calcAccuracy(5, 10)).toBe(50);
  });
  it('returns 92.31 for 12 of 13', () => {
    expect(calcAccuracy(12, 13)).toBe(92.31);
  });
});
