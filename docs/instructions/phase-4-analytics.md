# Phase 4 — Analytics: Implementation Instructions

> **Self-contained.** Read this file only. Implement features in the order listed.
> Requires Phase 2 to be complete (uses `GameMode` type).
> After each feature, run `cd frontend && npx tsc --noEmit`.

---

## What This Phase Adds

1. **Personal session history** — localStorage-backed graph of WPM across all your sessions, filterable by mode/duration
2. **Backend leaderboard** — `GET /leaderboard` endpoint returning top WPMs per duration from Supabase
3. **PNG export** — download your results screen as a shareable image using native Canvas API

---

## Codebase Snapshot (before changes)

### `frontend/src/types/index.ts` — relevant current types

```ts
export type GameMode = 'timed' | 'words' | 'quote' | 'custom'; // added in Phase 2
export type TimedMode = 15 | 30 | 60 | 120 | 'infinite';

export interface TestResults {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;
  peakWpm: number;
  longestPerfectStreak: number;
  wpmHistory: WpmDataPoint[];
  ngramMistakes: Record<string, number>;
  ngramFocused: string[];
  preRunSlowKeys: string[];
  ngramGraduated: Record<string, number>;
  difficultyHistory: DifficultyChange[];
  quote?: Quote;   // added in Phase 2
}
```

### `frontend/src/lib/ngramTracker.ts` — where to add history functions

The file already handles all localStorage persistence for the app.
Add the session history functions here to keep all localStorage logic in one place.

### `frontend/src/hooks/useTypingEngine.ts` — `finishTest` function location

`finishTest` is a `useCallback` inside `useTypingEngine`. It already calls:
```ts
saveTimingToStorage(s.ngramStats);
updateStrugglingPatterns(s.ngramStats, s.ngramGraduated);
saveActiveNgrams(s.ngrams);   // added in Phase 3
incrementSessionCount();
```
Add `saveSessionRecord(...)` here.

### `frontend/src/App.tsx` — current view state

```ts
const [view, setView] = useState<'typing' | 'wall'>('typing');
```
Extend to `'typing' | 'wall' | 'history'`.

### `frontend/src/components/Layout/Header.tsx` — current structure

Buttons in header: sound toggle | theme toggle | view toggle.
Add a new button for history view between theme and wall toggles.

### Backend: `backend/app/main.py` — router registration pattern

```python
app.include_router(sessions.router)
```
Add the leaderboard router here.

### Backend: Supabase `sessions` table schema

```sql
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  duration    integer not null check (duration in (15, 30, 60, 120)),
  wpm         numeric(6,2) not null,
  raw_wpm     numeric(6,2) not null,
  accuracy    numeric(5,2) not null,
  wpm_history jsonb not null default '[]',
  ngram_mistakes jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
```

RLS is enabled. Backend uses service role key (bypasses RLS). Read `backend/app/config.py` for the settings class and `backend/app/routes/sessions.py` for the existing route pattern to follow.

### localStorage keys already in use (do not conflict)

```
adapta-type-timing, adapta-type-flagged-slow, adapta-type-struggling,
adapta-type-patterns, adapta-type-session-count, adapta-type-sound,
adapta-type-theme, adapta-type-active-ngrams (Phase 3)
```

### Recharts usage pattern (from `WpmGraph.tsx`)

```tsx
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={220}>
  <ComposedChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
    <XAxis dataKey="t" tick={{ fill: '#9ca3af', fontSize: 12 }} />
    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
    <Tooltip />
    <Line type="monotone" dataKey="wpm" stroke="#facc15" strokeWidth={2} dot={false} />
  </ComposedChart>
</ResponsiveContainer>
```

---

## Feature 1 — Personal Session History

### Step 1a — New type

Add to `frontend/src/types/index.ts`:
```ts
export interface SessionRecord {
  date: number;       // Date.now() timestamp
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;   // seconds
  mode: GameMode;
}
```

### Step 1b — Storage functions in `frontend/src/lib/ngramTracker.ts`

Add at the bottom:

```ts
const HISTORY_KEY = 'adapta-type-history';
const MAX_HISTORY = 200;

export function saveSessionRecord(r: import('../types').SessionRecord): void {
  try {
    const history: import('../types').SessionRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    history.push(r);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* silent */ }
}

export function loadSessionHistory(): import('../types').SessionRecord[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}
```

### Step 1c — Call in `finishTest` (`useTypingEngine.ts`)

Import `saveSessionRecord` and `SessionRecord`. After `incrementSessionCount()`:

```ts
saveSessionRecord({
  date: Date.now(),
  wpm: results.wpm,
  rawWpm: results.rawWpm,
  accuracy: results.accuracy,
  duration: results.duration,
  mode: s.gameMode ?? 'timed',  // gameMode field added in Phase 2; default to 'timed' if missing
});
```

### Step 1d — New component: `frontend/src/components/Analytics/SessionHistory.tsx`

```tsx
import { useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { loadSessionHistory } from '../../lib/ngramTracker';
import type { SessionRecord, TimedMode } from '../../types';

const DURATIONS: (TimedMode | 'all')[] = ['all', 15, 30, 60, 120];

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function SessionHistory() {
  const [filter, setFilter] = useState<TimedMode | 'all'>('all');
  const history = loadSessionHistory();

  const filtered = filter === 'all'
    ? history
    : history.filter(r => r.duration === filter);

  // Downsample if too many points (> 100 → take every Nth)
  const step = Math.max(1, Math.floor(filtered.length / 100));
  const chartData = filtered
    .filter((_, i) => i % step === 0)
    .map(r => ({ date: formatDate(r.date), wpm: r.wpm, acc: r.accuracy }));

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-lg font-semibold font-mono mb-6 text-gray-700 dark:text-gray-300">
        session history
      </h2>

      {history.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-600 text-sm">
          no sessions recorded yet — complete a test to start tracking
        </p>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setFilter(d)}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  d === filter
                    ? 'bg-yellow-400 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {d === 'all' ? 'all' : d === 'infinite' ? '∞' : `${d}s`}
              </button>
            ))}
          </div>

          {/* Stats summary */}
          <div className="flex gap-8 mb-6 text-sm font-mono">
            <span className="text-gray-500">
              best <span className="text-yellow-400 font-semibold">
                {Math.max(...filtered.map(r => r.wpm))} wpm
              </span>
            </span>
            <span className="text-gray-500">
              avg <span className="text-gray-300 dark:text-gray-300 font-semibold">
                {Math.round(filtered.reduce((s, r) => s + r.wpm, 0) / Math.max(filtered.length, 1))} wpm
              </span>
            </span>
            <span className="text-gray-500">
              {filtered.length} test{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* WPM over time chart */}
          <div className="bg-gray-900 rounded-lg p-4 sm:p-6 mb-6">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 4 }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Line type="monotone" dataKey="wpm" name="wpm" stroke="#facc15"
                  strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#facc15' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
```

### Step 1e — Wire into `App.tsx`

Change view type:
```ts
const [view, setView] = useState<'typing' | 'wall' | 'history'>('typing');
```

Add in the `main` render:
```tsx
{view === 'history' ? (
  <SessionHistory />
) : view === 'wall' ? (
  <PatternWall ... />
) : ...}
```

Import `SessionHistory` from `./components/Analytics/SessionHistory`.

### Step 1f — Add history button to `Header.tsx`

Add to `Props`:
```ts
onToggleHistory: () => void;
isHistory: boolean;
```

Add button in the header nav (between theme toggle and wall toggle):
```tsx
<button
  onClick={onToggleHistory}
  title="session history"
  className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
>
  {/* Bar chart icon */}
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
</button>
```

---

## Feature 2 — Backend Leaderboard

### Step 2a — New backend route file: `backend/app/routes/leaderboard.py`

Follow the same pattern as the existing `sessions.py`. Read `backend/app/routes/sessions.py` to understand the Supabase client instantiation, rate limiter usage, and settings import pattern.

```python
from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.middleware.rate_limit import limiter

router = APIRouter()

@router.get("/leaderboard")
@limiter.limit("30/minute")
async def get_leaderboard(request: Request, duration: int = 30, limit: int = 10):
    """Return top WPM scores for a given duration."""
    if duration not in (15, 30, 60, 120):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="duration must be 15, 30, 60, or 120")
    if limit > 50:
        limit = 50

    from supabase import create_client
    client = create_client(settings.supabase_url, settings.supabase_service_key)

    result = (
        client.table("sessions")
        .select("wpm, created_at")
        .eq("duration", duration)
        .order("wpm", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data
```

### Step 2b — Register in `backend/app/main.py`

```python
from app.routes import sessions, leaderboard   # add leaderboard

app.include_router(sessions.router)
app.include_router(leaderboard.router)          # add this line
```

### Step 2c — Frontend component: `frontend/src/components/Analytics/Leaderboard.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { TimedMode } from '../../types';

interface LeaderboardEntry { wpm: number; created_at: string; }

const DURATIONS: TimedMode[] = [15, 30, 60, 120];

export function Leaderboard() {
  const [duration, setDuration] = useState<TimedMode>(30);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const backendUrl = import.meta.env.VITE_BACKEND_URL as string;
    fetch(`${backendUrl}/leaderboard?duration=${duration}&limit=10`)
      .then(r => r.ok ? r.json() : Promise.reject('fetch failed'))
      .then(setEntries)
      .catch(() => setError('could not load leaderboard'))
      .finally(() => setLoading(false));
  }, [duration]);

  return (
    <div className="mt-8">
      <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4">global leaderboard</h3>
      <div className="flex gap-2 mb-4">
        {DURATIONS.map(d => (
          <button key={d} onClick={() => setDuration(d)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              d === duration ? 'bg-yellow-400 text-gray-900'
                : 'text-gray-500 hover:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
            }`}>{d}s</button>
        ))}
      </div>
      {loading && <p className="text-xs text-gray-500 font-mono">loading...</p>}
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      {!loading && !error && (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center gap-3 text-sm font-mono">
              <span className="text-gray-600 dark:text-gray-700 w-5 text-right">{i + 1}.</span>
              <span className="text-yellow-400 font-semibold">{e.wpm}</span>
              <span className="text-gray-500">wpm</span>
              <span className="text-gray-600 dark:text-gray-700 text-xs ml-auto">
                {new Date(e.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
          {entries.length === 0 && (
            <p className="text-xs text-gray-500">no scores yet for {duration}s</p>
          )}
        </ol>
      )}
    </div>
  );
}
```

Add `<Leaderboard />` inside the `SessionHistory` component, below the chart, or as its own section in `App.tsx`.

---

## Feature 3 — PNG Export

### Step 3a — New file: `frontend/src/lib/export.ts`

```ts
import type { TestResults } from '../types';

export function exportResultsAsPng(results: TestResults): void {
  const W = 800, H = 400;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, W, H);

  // Logo
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#facc15';
  ctx.fillText('adapta', 40, 60);
  ctx.fillStyle = '#d1d5db';
  ctx.fillText('type', 40 + ctx.measureText('adapta').width, 60);

  // Main WPM
  ctx.font = 'bold 96px monospace';
  ctx.fillStyle = '#facc15';
  ctx.fillText(String(results.wpm), 40, 180);
  ctx.font = '18px monospace';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('wpm', 40, 210);

  // Stats row
  const stats = [
    { label: 'raw', value: String(results.rawWpm) },
    { label: 'acc', value: `${results.accuracy}%` },
    { label: 'time', value: `${results.duration}s` },
  ];
  let sx = 220;
  for (const s of stats) {
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(s.value, sx, 160);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(s.label.toUpperCase(), sx, 180);
    sx += 140;
  }

  // Struggled patterns
  const struggled = Object.keys(results.ngramMistakes).slice(0, 6);
  if (struggled.length > 0) {
    ctx.font = '13px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('struggled with', 40, 270);
    let px = 40;
    for (const ng of struggled) {
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#f87171';
      ctx.fillText(ng, px, 295);
      px += ctx.measureText(ng).width + 16;
    }
  }

  // Watermark
  ctx.font = '11px monospace';
  ctx.fillStyle = '#374151';
  ctx.fillText('adaptatype.com', W - 160, H - 20);

  // Download
  const a = document.createElement('a');
  a.download = `adaptatype-${results.wpm}wpm.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
```

### Step 3b — Add export button to `ResultsScreen.tsx`

Import the function:
```ts
import { exportResultsAsPng } from '../../lib/export';
```

Add button beside the restart button:
```tsx
<div className="flex justify-center gap-3">
  <button
    onClick={() => exportResultsAsPng(results)}
    className="flex items-center gap-2 px-4 py-2.5 rounded bg-gray-200 dark:bg-gray-800
               text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700
               transition-colors font-medium text-sm"
    title="download results as PNG"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    export
  </button>

  <button onClick={onRestart} ...>  {/* existing restart button */}
    restart
  </button>
</div>
```

---

## Verification

```bash
cd frontend && npx tsc --noEmit
npm run test
```

Manual smoke tests:

**Session history:**
1. Complete 3+ tests of different durations.
2. Click the history icon in the header — history view opens.
3. WPM line chart shows your sessions chronologically.
4. Filter to `30s` — only 30s sessions shown.
5. Best/avg stats update to match filtered set.

**Leaderboard:**
1. Requires the backend to be running (`cd backend && uvicorn app.main:app --reload`).
2. In history view, leaderboard section loads top scores for 30s.
3. Switching duration tabs reloads the leaderboard.
4. `GET /leaderboard?duration=30` returns JSON array directly from the API.

**PNG export:**
1. Complete a test.
2. On results screen, click "export".
3. A PNG file downloads named `adaptatype-{wpm}wpm.png`.
4. Image is 800×400px, dark background, shows WPM prominently.
