import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingEngine } from './useTypingEngine';

describe('useTypingEngine', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useTypingEngine());
    expect(result.current.state.testState).toBe('idle');
  });

  it('transitions to running on first keypress', () => {
    const { result } = renderHook(() => useTypingEngine());
    act(() => {
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(result.current.state.testState).toBe('running');
  });

  it('marks correct char as correct', () => {
    const { result } = renderHook(() => useTypingEngine());
    const firstChar = result.current.state.line.words[0][0];
    act(() => {
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: firstChar }));
    });
    expect(result.current.state.line.charStates[0][0]).toBe('correct');
  });

  it('marks wrong char as incorrect', () => {
    const { result } = renderHook(() => useTypingEngine());
    const firstChar = result.current.state.line.words[0][0];
    const wrongKey = firstChar === 'a' ? 'z' : 'a';
    act(() => {
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: wrongKey }));
    });
    expect(result.current.state.line.charStates[0][0]).toBe('incorrect');
  });

  it('resets to idle on reset()', () => {
    const { result } = renderHook(() => useTypingEngine());
    act(() => {
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'a' }));
      result.current.reset();
    });
    expect(result.current.state.testState).toBe('idle');
  });

  it('blocks space mid-word (does not advance word)', () => {
    const { result } = renderHook(() => useTypingEngine());
    const initialWord = result.current.state.currentWord;
    act(() => {
      // Space at start of word — no chars typed yet
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
    });
    expect(result.current.state.currentWord).toBe(initialWord);
  });

  it('backspace undoes last char', () => {
    const { result } = renderHook(() => useTypingEngine());
    const firstChar = result.current.state.line.words[0][0];
    act(() => {
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: firstChar }));
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    });
    expect(result.current.state.currentChar).toBe(0);
    expect(result.current.state.line.charStates[0][0]).toBe('untyped');
  });

  it('changeDuration resets the test and updates duration', () => {
    const { result } = renderHook(() => useTypingEngine());
    act(() => {
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'a' }));
      result.current.changeDuration(60);
    });
    expect(result.current.state.testState).toBe('idle');
    expect(result.current.state.duration).toBe(60);
    expect(result.current.state.timeLeft).toBe(60);
  });

  it('ignores modifier key combinations', () => {
    const { result } = renderHook(() => useTypingEngine());
    act(() => {
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));
    });
    // State should stay idle — ctrl+key should be ignored
    expect(result.current.state.testState).toBe('idle');
  });
});
