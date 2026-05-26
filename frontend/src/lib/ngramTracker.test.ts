import { describe, it, expect } from 'vitest';
import { updateNgramStats, promoteNgrams } from './ngramTracker';

const e = (seen: number, errors: number) => ({ seen, errors, totalMs: 0, timedCount: 0 });

describe('updateNgramStats', () => {
  it('tracks bigram on second char', () => {
    const stats = updateNgramStats('the', 1, false, {}, null);
    expect(stats['th'].seen).toBe(1);
    expect(stats['th'].errors).toBe(1);
  });

  it('counts error even if later fixed (muscle memory)', () => {
    let stats = updateNgramStats('the', 1, false, {}, null); // wrong
    stats = updateNgramStats('the', 1, true, stats, null);   // correct retry
    expect(stats['th'].seen).toBe(2);
    expect(stats['th'].errors).toBe(1);
  });

  it('does not track anything on first char (index 0)', () => {
    const stats = updateNgramStats('the', 0, false, {}, null);
    expect(Object.keys(stats)).toHaveLength(0);
  });

  it('tracks trigram on third char', () => {
    const stats = updateNgramStats('the', 2, false, {}, null);
    expect(stats['he']).toBeDefined();   // bigram
    expect(stats['the']).toBeDefined();  // trigram
  });

  it('increments seen without incrementing errors on correct key', () => {
    const stats = updateNgramStats('the', 1, true, {}, null);
    expect(stats['th'].seen).toBe(1);
    expect(stats['th'].errors).toBe(0);
  });

  it('accumulates across multiple calls', () => {
    let stats = updateNgramStats('the', 1, false, {}, null);
    stats = updateNgramStats('the', 1, false, stats, null);
    expect(stats['th'].seen).toBe(2);
    expect(stats['th'].errors).toBe(2);
  });
});

describe('promoteNgrams', () => {
  it('does NOT promote below error count threshold (1 error of 2 seen)', () => {
    const stats = { th: e(2, 1) };
    const result = promoteNgrams('the', stats, {}, {}, {}, null);
    expect(result).toEqual({});
  });

  it('does NOT promote below error rate threshold (2 errors but only 10% rate)', () => {
    const stats = { th: e(20, 2) };
    const result = promoteNgrams('the', stats, {}, {}, {}, null);
    expect(result).toEqual({});
  });

  it('promotes bigram meeting both thresholds (2 errors, 50% rate)', () => {
    const stats = { th: e(4, 2) };
    const result = promoteNgrams('the', stats, {}, {}, {}, null);
    expect(result).toHaveProperty('th');
    expect(result['th']).toBe(2); // value = error count
  });

  it('upgrades bigram to trigram when trigram also qualifies', () => {
    const stats = { th: e(4, 2), the: e(4, 2) };
    const result = promoteNgrams('the', stats, {}, {}, {}, null);
    expect(result).toHaveProperty('the');
    expect(result).not.toHaveProperty('th');
  });

  it('keeps bigram if trigram does not meet threshold', () => {
    const stats = { th: e(4, 2), the: e(10, 1) };
    const result = promoteNgrams('the', stats, {}, {}, {}, null);
    expect(result).toHaveProperty('th');
    expect(result).not.toHaveProperty('the');
  });

  it('never re-promotes a graduated pattern', () => {
    const stats = { th: e(4, 2) };
    const result = promoteNgrams('the', stats, {}, { th: 1 }, {}, null);
    expect(result).not.toHaveProperty('th');
  });

  it('leaves already-promoted patterns unchanged', () => {
    const stats = { th: e(4, 2) };
    const result = promoteNgrams('the', stats, { th: 2 }, {}, {}, null);
    expect(result['th']).toBe(2); // unchanged
  });
});
