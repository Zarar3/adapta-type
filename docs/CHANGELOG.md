# Changelog

## Session — 2026-06-15 (part 2)

### Race Mode UX Overhaul

#### Word count selection
**File:** `frontend/src/components/Race/RaceRoom.tsx`

Added a word count picker (20 / 30 / 40 / 50) to the race selection screen, shown above the bots/players buttons. `WORD_TARGET = 50` (hardcoded constant) was removed and replaced with a `wordTarget: number` prop passed down from App. `onChangeWordTarget` callback lets App own the state (default 30). `startWordCountSession` in `useTypingEngine.ts` now accepts `number` instead of `WordCountTarget` so any target value works without a type cast. Bot simulation effect also updated to use the prop and lists it in deps.

#### Clean race mode UI
**File:** `frontend/src/components/TypingTest/TypingArea.tsx`

Added `isRaceMode?: boolean` prop. When true:
- `TimerBar` is hidden (progress is already visible in the RaceRoom HUD)
- N-gram "focusing on" chips are hidden
- Difficulty flash label (easy / medium / hard / expert) is hidden
- Idle "click here or start typing" hint is hidden
- Outer container narrows from `max-w-5xl` to `max-w-2xl` to keep the typing area tight and centered

Live WPM/accuracy and the "fix the highlighted word first" message remain visible. `isRaceMode` is passed from the race rendering branch in `App.tsx`.

#### requireCorrectWord confirmed race-only
No code change. `useTypingEngine(view === 'race' && raceStarted)` already passes `requireCorrectWord=true` only during an active race. All other modes are unaffected.

---

### WPM Graph Smoothing
**File:** `frontend/src/components/Results/WpmGraph.tsx`

Added `smoothPoints()` — a 3-point moving average applied to `wpmHistory` before rendering. Each data point's `wpm` and `raw` values are averaged with their immediate neighbours. Error bar counts are left unsmoothed. Fixes the jagged/erratic appearance of the WPM line in race mode, where forced word corrections cause bursts of low then high correct-char counts per second.

---

### Share Card Preview Modal
**Files:** `frontend/src/lib/export.ts`, `frontend/src/components/Results/ResultsScreen.tsx`

Previously clicking "share" immediately triggered a native share sheet or PNG download. Now:

- `shareCard(results)` returns `Promise<string>` (a blob object URL) instead of being void
- `downloadShareCard(url, wpm)` is a new exported helper for the explicit download action
- `ResultsScreen` holds `shareUrl` state; clicking "share" generates the card and sets the URL
- A fullscreen overlay renders with the 1200×630 image scaled to fit, a "download" button, and a "close" button. Clicking the backdrop also closes it. The object URL is revoked on close to free memory.

---

### Bot Race 3rd/4th Placement Bug Fix
**File:** `frontend/src/components/Race/RaceRoom.tsx`

3rd and 4th place bot labels were never showing as placement boxes — they kept rendering as progress bars even after reaching 30/30. Root cause: `newlyFinished` was populated inside the `setBots` updater function (which React runs asynchronously), but `setPlacements` was called right after in the same synchronous interval tick — before the updater had executed. So the `newlyFinished` array was always empty at the point of the `setPlacements` call, and the placement was permanently missed (on subsequent ticks the bot's `finished` flag is already `true` so it early-returns and never pushes again).

Fix: removed the external `newlyFinished` variable. Inside the `setBots` updater, the newly-finished bots are now detected by diffing `prev` vs `updated` (`b.finished && !prev[i].finished`), and `setPlacements` is called from inside the updater. Both state updates now happen in the same React flush.

---

## Session — 2026-06-15

### Bug Fixes

#### White screen on typing (critical)
**File:** `frontend/src/hooks/useTypingEngine.ts`

`let displayOrder` and `let waitQueue` were declared on line 404 but referenced in `.filter()` callbacks on lines 379–384 — temporal dead zone crash on every space press. Fixed by moving the two declarations to before the `displaySlotNgrams` computation.

#### Blank page on race button click (critical)
**File:** `frontend/src/components/Race/RaceRoom.tsx`

`const backendWs = (import.meta.env.VITE_BACKEND_URL as string).replace(...)` was computed at the top of the component body. When `VITE_BACKEND_URL` is undefined on Vercel, `.replace()` on `undefined` threw on mount. Fixed by moving the computation inside the players-only `useEffect`.

#### Space could be used to skip incorrectly typed words in race mode
**File:** `frontend/src/hooks/useTypingEngine.ts`

Added `requireCorrectWord` parameter to `useTypingEngine` (default `false`). When true, space is blocked if any character in the current word is still marked incorrect. Used a ref to keep the value current inside the `useCallback` closure. `App.tsx` passes `requireCorrectWord={view === 'race' && raceStarted}` so the gate only applies in race mode — all other modes behave exactly as before.

---

### N-gram Queue Enforcement
**File:** `frontend/src/hooks/useTypingEngine.ts`

Previously all promoted n-gram patterns could influence word generation simultaneously. Fixed to enforce a hard cap of 5 active display slots:

- `buildInitialState` splits merged ngrams into `initialDisplay` (first 5) and `initialQueue` (rest)
- Space-press handler maintains `displayOrder` and `waitQueue` arrays: when a pattern graduates (streak threshold met), its slot is freed and the next pattern in `waitQueue` is promoted
- `generateWord` fallback filters to `displayOrder` patterns only — queue patterns never influence word generation until they enter a display slot
- `updateStreaks` only processes patterns in active display slots; queue patterns accumulate no streak data

---

### Bigram Heatmap Rehaul
**File:** `frontend/src/components/Results/BigramHeatmap.tsx`

Complete rewrite. Replaced bar charts with ratio labels ("2.1×") with a plain-English chip list:

- Merges top 5 slow patterns (timing ratio ≥ 1.3) and top 5 error-prone patterns, deduplicated
- Labels: *"takes you longer to type"* / *"you often mistype this"* / *"slow and often mistyped"*
- Practice buttons (15s / 30s / 60s) expand on click — same pattern as existing `ResultsScreen` chips
- Section title changed from "bigram profile" to "weak spots (all time)"
- 3-session gate preserved
- `ResultsScreen` updated to pass `onPracticePattern` down as a prop

---

### Phase 5 — Social & Competitive Features

#### Share card
**File:** `frontend/src/lib/export.ts` (new)

`shareCard(results)` renders a 1200×630 canvas: dark background, yellow accent bar, large WPM, raw/accuracy/time stats, struggled patterns, watermark. Tries `navigator.share({ files })` first (mobile native share sheet), falls back to PNG download. Share button added to `ResultsScreen`.

#### Challenge mode
**Files:** `frontend/src/App.tsx`, `frontend/src/components/Results/ResultsScreen.tsx`

On mount, App reads `?challenge=XX` from the URL. If the pattern has sufficient word coverage, `startFocusedSession` is called automatically and the param is stripped from the URL. After a focused session, ResultsScreen shows a "challenge a friend" button that copies the `?challenge=XX` URL to clipboard with a 2-second "copied!" confirmation.

#### Multiplayer race (vs players)
**Files:** `backend/app/routes/race.py` (new), `backend/app/main.py`, `frontend/src/components/Race/RaceRoom.tsx`

Backend: FastAPI WebSocket endpoint `/race/{room_id}`. In-memory room store (`rooms`, `room_players` dicts). Handles `joined`, `progress`, `update`, `finished`, `left` message types. `broadcast()` helper cleans up dead connections.

Frontend: `RaceRoom` connects to the backend WebSocket only when `raceType === 'players'`. Shows room code, "copy invite link" button, per-player progress bars, winner detection.

---

### Race Mode — Bot Racing
**File:** `frontend/src/components/Race/RaceRoom.tsx`

Selection screen (vs bots / vs players) on entering race mode. Bot race features:

**Difficulty & WPM ranges:**
| Difficulty | WPM range |
|---|---|
| Easy | 20–70 |
| Medium | 30–90 |
| Hard | 40–100 |

**Accuracy ranges (fluctuates per 100ms tick):**
| Difficulty | Accuracy range |
|---|---|
| Easy | 40–60% |
| Medium | 60–70% |
| Hard | 70–90% |

Bot effective speed = `wpm × (accuracy / 100)`. Accuracy drifts ±2% each tick, clamped to the bot's range. Three named bots: typerbot, swiftkeys, dashfinger.

**Placement system:** When any participant finishes, their progress bar lane is replaced by a placement box showing e.g. "1st — typerbot" with final WPM. Remaining racers continue showing live progress bars. Supports all 4 finishers (ordinal: 1st / 2nd / 3rd / 4th).

**Real-time accuracy display:** Each bot lane shows `"61 wpm · 55% acc · 12/50"` updating every tick.

---

### Race Mode — Layout & UX
**Files:** `frontend/src/App.tsx`, `frontend/src/components/Layout/Header.tsx`

- Lightning bolt button in header (yellow when race is active)
- Race HUD (progress bars) renders above the typing area — both visible simultaneously once race starts
- `raceStarted` state in `App.tsx` controls when TypingArea appears alongside the HUD
- URL param `?room=CODE` on mount auto-joins a multiplayer room

**Correct-word gate (race only):**
- Pressing space on a word with remaining errors silently blocks and shows "fix the highlighted word first" under the words
- Dismissed on next keypress
- Disclaimer shown before race start: "you must type each word correctly before advancing"
- `spaceBlocked: boolean` in engine state; `requireCorrectWord` param on `useTypingEngine` hook
