# localStorage Keys Reference

Every key this app reads and writes. All data stays on the user's machine.

---

| Key | Type | Purpose |
|---|---|---|
| `adapta-type-timing` | `Record<string, { totalMs: number; count: number }>` | Cumulative inter-keystroke timing per bigram/trigram, accumulated across all sessions |
| `adapta-type-flagged-slow` | `Record<string, { ratio: number }>` | Patterns ever flagged as slow (ratio = ms/overall at time of flagging). Never removed, even after improvement |
| `adapta-type-struggling` | `Record<string, { rate: number; practiceCount: number }>` | Patterns with any error in any session. `rate` = original error rate when first added. Removed when: streak-graduated OR (practiceCount >= 3 AND currentRate < rate / 1.5) |
| `adapta-type-patterns` | `Record<string, PatternRecord>` | Full pattern library for the Pattern Wall. Accumulated across all sessions. Contains best WPM, best accuracy, session count, completed flag |
| `adapta-type-session-count` | `string` (parsed as int) | Count of completed tests. Used to gate the timing profile empty state message (need >= 3) |
| `adapta-type-sound` | `'true' \| 'false'` | Sound enabled/disabled preference |

---

## Notes

**`adapta-type-timing`** grows indefinitely. Each test adds to the cumulative totals. This is intentional — more data = more accurate slow detection. There is no pruning logic.

**`adapta-type-flagged-slow`** is write-once per pattern. Once a pattern is flagged, it stays forever. The `improved` flag on `SlowPattern` is computed fresh each call to `getSlowPatterns()` by comparing current ratio to the stored flagged ratio.

**`adapta-type-struggling`** is the newest key (added mid-project). It's the error-based counterpart to `adapta-type-flagged-slow`. Unlike the flagged-slow map, struggling entries CAN be removed (auto-graduation).

**`adapta-type-patterns`** is managed by `usePatternLibrary` hook and feeds the Pattern Wall. It's separate from the struggling map — the Pattern Wall is a UI-level history view, while the struggling map drives the results screen's "still struggling" chips.

---

## If You Want to Reset

To clear all adaptive data and start fresh, delete all 6 keys from DevTools → Application → Local Storage. Or target specific ones:
- Reset timing profile: delete `adapta-type-timing` and `adapta-type-flagged-slow`
- Reset struggling tracker: delete `adapta-type-struggling`
- Reset pattern wall: delete `adapta-type-patterns`
- Reset session count: delete `adapta-type-session-count`
