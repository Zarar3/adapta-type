import { useCallback, useState } from 'react';

const STORAGE_KEY = 'adapta-type-patterns';

export interface PatternRecord {
  pattern: string;
  totalErrors: number;
  completed: boolean;
  bestWpm?: number;
  bestAccuracy?: number;
  sessionCount?: number;
}

function loadLibrary(): Record<string, PatternRecord> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function usePatternLibrary() {
  const [library, setLibrary] = useState<Record<string, PatternRecord>>(loadLibrary);

  const persist = (updated: Record<string, PatternRecord>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  };

  const addFromSession = useCallback((
    mistakes: Record<string, number>,
    graduated: Record<string, number>,
  ) => {
    setLibrary(prev => {
      const updated = { ...prev };
      for (const [pattern, errors] of Object.entries(mistakes)) {
        updated[pattern] = {
          ...updated[pattern],
          pattern,
          totalErrors: (updated[pattern]?.totalErrors ?? 0) + errors,
          completed: updated[pattern]?.completed ?? false,
        };
      }
      for (const pattern of Object.keys(graduated)) {
        if (!updated[pattern]) {
          updated[pattern] = { pattern, totalErrors: 0, completed: false };
        }
      }
      return persist(updated);
    });
  }, []);

  const markCompleted = useCallback((pattern: string) => {
    setLibrary(prev => {
      if (!prev[pattern]) return prev;
      const updated = { ...prev, [pattern]: { ...prev[pattern], completed: true } };
      return persist(updated);
    });
  }, []);

  const recordFocusedSession = useCallback((pattern: string, wpm: number, accuracy: number) => {
    setLibrary(prev => {
      const existing = prev[pattern];
      if (!existing) return prev;
      const updated = {
        ...prev,
        [pattern]: {
          ...existing,
          sessionCount: (existing.sessionCount ?? 0) + 1,
          bestWpm: existing.bestWpm !== undefined ? Math.max(existing.bestWpm, wpm) : wpm,
          bestAccuracy: existing.bestAccuracy !== undefined ? Math.max(existing.bestAccuracy, accuracy) : accuracy,
        },
      };
      return persist(updated);
    });
  }, []);

  const clearLibrary = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setLibrary({});
  }, []);

  return { library, addFromSession, markCompleted, recordFocusedSession, clearLibrary };
}
