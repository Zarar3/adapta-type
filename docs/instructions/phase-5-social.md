# Phase 5 — Social & Competitive: Implementation Instructions

> **Self-contained.** Read this file only. Implement features in the order listed.
> Feature 3 (multiplayer) requires Phase 2 (`GameMode`, `WordCountTarget`) to be complete.
> After each feature, run `cd frontend && npx tsc --noEmit`.

---

## What This Phase Adds

1. **Shareable result card** — "share result" button that generates and downloads/shares a polished PNG card
2. **Challenge mode** — URL param `?challenge=th` pre-seeds a focused session; "challenge a friend" copies a shareable URL
3. **Multiplayer race** — WebSocket-based real-time typing race; anonymous, room-code based

---

## Codebase Snapshot (before changes)

### `frontend/src/types/index.ts` — relevant types

```ts
export type GameMode = 'timed' | 'words' | 'quote' | 'custom'; // Phase 2

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
  quote?: Quote;  // Phase 2
}
```

### `frontend/src/App.tsx` — current structure

```tsx
export default function App() {
  const { state, handleKeyDown, reset, changeDuration, startFocusedSession, endTest,
          startWordCountSession, startQuoteSession, startCustomSession } = useTypingEngine();
  const [view, setView] = useState<'typing' | 'wall' | 'history'>('typing');

  // On mount in useEffect: Tab+Enter handler
  // On test finish in useEffect: addFromSession, markCompleted, recordFocusedSession
}
```

### `frontend/src/lib/wordSelector.ts` — relevant export

```ts
export function hasSufficientCoverage(pattern: string): boolean
// Returns true if ≥5 words in WORD_LIST contain the pattern
```

### `frontend/src/hooks/useTypingEngine.ts` — relevant export

```ts
startFocusedSession(pattern: string, duration: TimedMode): void
// Launches a focused practice session for a specific pattern
```

### `frontend/src/components/Results/ResultsScreen.tsx` — current bottom section

```tsx
<div className="flex justify-center gap-3">
  <button onClick={() => exportResultsAsPng(results)} ...>export</button>   {/* Phase 4 */}
  <button onClick={onRestart} ...>restart</button>
</div>
```

### `frontend/src/lib/export.ts` — created in Phase 4

```ts
export function exportResultsAsPng(results: TestResults): void
// Downloads an 800×400 PNG of the results
```

### Backend: existing FastAPI structure (`backend/app/main.py`)

```python
app.include_router(sessions.router)
app.include_router(leaderboard.router)  # Phase 4
```

---

## Feature 1 — Shareable Result Card

This extends `frontend/src/lib/export.ts` from Phase 4.

### Step 1a — Add `shareCard` to `frontend/src/lib/export.ts`

```ts
export async function shareCard(results: TestResults): Promise<void> {
  const W = 1200, H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background with subtle gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0f1a');
  grad.addColorStop(1, '#030712');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Top accent bar
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, W, 4);

  // Logo
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#facc15';
  const logoX = 60;
  ctx.fillText('adapta', logoX, 80);
  ctx.fillStyle = '#6b7280';
  ctx.fillText('type', logoX + ctx.measureText('adapta').width, 80);

  // Giant WPM
  ctx.font = 'bold 180px monospace';
  ctx.fillStyle = '#facc15';
  ctx.fillText(String(results.wpm), 60, 320);

  // "WPM" label
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#374151';
  ctx.fillText('WPM', 60, 360);

  // Right side stats
  const statsY = 180;
  const statsX = W - 320;
  const drawStat = (label: string, value: string, y: number) => {
    ctx.font = '16px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(label.toUpperCase(), statsX, y);
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(value, statsX, y + 50);
  };
  drawStat('raw', String(results.rawWpm), statsY);
  drawStat('acc', `${results.accuracy}%`, statsY + 110);
  drawStat('time', `${results.duration}s`, statsY + 220);

  // Struggled patterns row
  const struggled = Object.keys(results.ngramMistakes).slice(0, 8);
  if (struggled.length > 0) {
    ctx.font = '16px monospace';
    ctx.fillStyle = '#374151';
    ctx.fillText('struggled with', 60, 430);
    let px = 60;
    for (const ng of struggled) {
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#f87171';
      ctx.fillText(ng, px, 460);
      px += ctx.measureText(ng).width + 24;
    }
  }

  // Watermark
  ctx.font = '16px monospace';
  ctx.fillStyle = '#1f2937';
  ctx.fillText('adaptatype.com', W - 220, H - 24);

  // Try Web Share API first, fall back to download
  canvas.toBlob(async blob => {
    if (!blob) return;
    const file = new File([blob], 'adaptatype-result.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${results.wpm} WPM on Adapta-Type` });
        return;
      } catch { /* fall through to download */ }
    }
    // Download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adaptatype-${results.wpm}wpm.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
```

### Step 1b — Add "share result" button to `ResultsScreen.tsx`

```tsx
import { exportResultsAsPng, shareCard } from '../../lib/export';

// In the button row:
<button
  onClick={() => shareCard(results)}
  className="flex items-center gap-2 px-4 py-2.5 rounded bg-gray-200 dark:bg-gray-800
             text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700
             transition-colors font-medium text-sm"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
  share
</button>
```

---

## Feature 2 — Challenge Mode

### Step 2a — Read URL param on app mount (`App.tsx`)

Inside the component, before the return statement:

```tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const challenge = params.get('challenge');
  if (challenge && challenge.length >= 2 && challenge.length <= 3) {
    // Import hasSufficientCoverage dynamically to avoid circular deps
    import('./lib/wordSelector').then(({ hasSufficientCoverage }) => {
      if (hasSufficientCoverage(challenge)) {
        startFocusedSession(challenge, 30);
        // Clean URL without reload
        window.history.replaceState({}, '', window.location.pathname);
      }
    });
  }
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

### Step 2b — "Challenge a friend" button in `ResultsScreen.tsx`

Show only when `focusedPattern` is set (i.e. the user just finished a focused practice session):

```tsx
{focusedPattern && (
  <div className="flex justify-center mb-6">
    <button
      onClick={() => {
        const url = `${window.location.origin}${window.location.pathname}?challenge=${focusedPattern}`;
        navigator.clipboard.writeText(url).then(() => {
          // Show brief "copied!" feedback — use a local state toggle
        });
      }}
      className="text-xs text-gray-500 hover:text-yellow-400 font-mono transition-colors flex items-center gap-1.5"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      challenge a friend with "{focusedPattern}"
    </button>
  </div>
)}
```

Add local state for copy feedback:
```tsx
const [copied, setCopied] = useState(false);
// In the click handler:
navigator.clipboard.writeText(url).then(() => {
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
});
// In the button text: {copied ? 'copied!' : `challenge a friend with "${focusedPattern}"`}
```

---

## Feature 3 — Multiplayer Race

### Architecture

- **Room code:** random 6-char alphanumeric string
- **Transport:** native browser `WebSocket` (no library)
- **Backend:** FastAPI `WebSocket` endpoint with in-memory room management
- **Race format:** first to complete 50 words wins (uses Phase 2 word-count mode)
- **Players:** anonymous; identified by random UUID assigned on connect

### Step 3a — Backend: `backend/app/routes/race.py`

```python
import asyncio
import json
import uuid
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# In-memory room store — resets on server restart, fine for MVP
rooms: Dict[str, Set[WebSocket]] = {}
room_players: Dict[str, Dict[str, dict]] = {}  # room_id → {player_id → {progress, wpm, finished}}

@router.websocket("/race/{room_id}")
async def race_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    player_id = str(uuid.uuid4())[:8]

    if room_id not in rooms:
        rooms[room_id] = set()
        room_players[room_id] = {}

    rooms[room_id].add(websocket)
    room_players[room_id][player_id] = {"progress": 0, "wpm": 0, "finished": False}

    # Announce new player
    await broadcast(room_id, {"type": "joined", "playerId": player_id, "total": len(rooms[room_id])})

    try:
        async for raw in websocket.iter_text():
            msg = json.loads(raw)
            if msg.get("type") == "progress":
                room_players[room_id][player_id]["progress"] = msg.get("wordsCompleted", 0)
                room_players[room_id][player_id]["wpm"] = msg.get("wpm", 0)
                await broadcast(room_id, {
                    "type": "update",
                    "players": room_players[room_id],
                })
            elif msg.get("type") == "finished":
                room_players[room_id][player_id]["finished"] = True
                await broadcast(room_id, {
                    "type": "finished",
                    "playerId": player_id,
                    "wpm": msg.get("wpm", 0),
                    "players": room_players[room_id],
                })
    except WebSocketDisconnect:
        rooms[room_id].discard(websocket)
        room_players[room_id].pop(player_id, None)
        if not rooms[room_id]:
            del rooms[room_id]
            del room_players[room_id]
        else:
            await broadcast(room_id, {"type": "left", "playerId": player_id, "total": len(rooms[room_id])})


async def broadcast(room_id: str, data: dict):
    if room_id not in rooms:
        return
    dead = set()
    for ws in rooms[room_id]:
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            dead.add(ws)
    rooms[room_id] -= dead
```

### Step 3b — Register in `backend/app/main.py`

```python
from app.routes import sessions, leaderboard, race

app.include_router(sessions.router)
app.include_router(leaderboard.router)
app.include_router(race.router)
```

Also add WebSocket to CORS allowed methods:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin],
    allow_methods=["POST", "GET", "WS"],  # add WS
    allow_headers=["Content-Type"],
)
```

### Step 3c — Frontend: `frontend/src/components/Race/RaceRoom.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import type { TimedMode } from '../../types';

interface Player {
  progress: number;
  wpm: number;
  finished: boolean;
}

interface Props {
  roomId: string;
  wordTarget: number;
  onStart: () => void;        // calls startWordCountSession(50) in the engine
  wordsCompleted: number;     // from engine state, updated each word
  currentWpm: number;         // live WPM from engine
  isFinished: boolean;        // engine testState === 'finished'
  onLeave: () => void;
}

const WORD_TARGET = 50;

export function RaceRoom({ roomId, onStart, wordsCompleted, currentWpm, isFinished, onLeave }: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const backendWs = (import.meta.env.VITE_BACKEND_URL as string).replace(/^http/, 'ws');

  useEffect(() => {
    const ws = new WebSocket(`${backendWs}/race/${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'joined' && !myId) setMyId(msg.playerId);
      if (msg.type === 'update') setPlayers(msg.players);
      if (msg.type === 'finished') {
        setPlayers(msg.players);
        if (!winner) setWinner(msg.playerId);
      }
    };

    return () => ws.close();
  }, [roomId]);

  // Send progress update every word
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'progress', wordsCompleted, wpm: currentWpm }));
    }
  }, [wordsCompleted, currentWpm]);

  // Send finished event
  useEffect(() => {
    if (isFinished && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'finished', wpm: currentWpm }));
    }
  }, [isFinished]);

  const playerList = Object.entries(players).sort(([, a], [, b]) => b.progress - a.progress);
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 font-mono mb-1">room code</p>
          <p className="text-yellow-400 font-mono font-bold text-xl tracking-widest">{roomId}</p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(shareUrl)}
          className="text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors"
        >
          copy invite link
        </button>
        <button onClick={onLeave} className="text-xs text-gray-600 hover:text-gray-400 font-mono">leave</button>
      </div>

      {!connected && (
        <p className="text-yellow-400/60 text-sm font-mono mb-4">connecting...</p>
      )}

      {winner && (
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4 mb-6 text-center">
          <p className="text-yellow-400 font-mono font-bold">
            {winner === myId ? '🏆 you won!' : `player ${winner} finished first`}
          </p>
        </div>
      )}

      {/* Player progress bars */}
      <div className="space-y-3 mb-8">
        {playerList.map(([id, p]) => (
          <div key={id}>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className={id === myId ? 'text-yellow-400' : 'text-gray-500'}>
                {id === myId ? 'you' : `player ${id.slice(0, 4)}`}
                {p.finished && ' ✓'}
              </span>
              <span className="text-gray-600">{p.wpm} wpm · {p.progress}/{WORD_TARGET}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${id === myId ? 'bg-yellow-400' : 'bg-gray-600'}`}
                style={{ width: `${(p.progress / WORD_TARGET) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Start button — only shown before typing begins */}
      {connected && Object.keys(players).length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={onStart}
            className="px-6 py-2.5 rounded bg-yellow-400 text-gray-900 font-medium hover:bg-yellow-300 transition-colors"
          >
            ready — start typing
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 3d — Wire into `App.tsx`

Add view state:
```ts
const [view, setView] = useState<'typing' | 'wall' | 'history' | 'race'>('typing');
const [raceRoomId, setRaceRoomId] = useState<string | null>(null);
```

Read `?room=` URL param on mount (alongside the `?challenge=` handler):
```ts
const room = params.get('room');
if (room) {
  setRaceRoomId(room);
  setView('race');
  window.history.replaceState({}, '', window.location.pathname);
}
```

Generate room code:
```ts
const createRoom = useCallback(() => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  setRaceRoomId(code);
  setView('race');
}, []);
```

Add in `main` render:
```tsx
{view === 'race' && raceRoomId ? (
  <RaceRoom
    roomId={raceRoomId}
    wordTarget={50}
    onStart={() => startWordCountSession(50)}
    wordsCompleted={state.wordsCompleted ?? 0}
    currentWpm={/* compute from correctChars + elapsed */}
    isFinished={state.testState === 'finished'}
    onLeave={() => { setView('typing'); setRaceRoomId(null); reset(); }}
  />
) : /* ... existing views */}
```

Add a "race" button in `Header.tsx` (lightning bolt icon).

---

## Verification

```bash
cd frontend && npx tsc --noEmit
npm run test
```

Manual smoke tests:

**Share card:**
1. Complete a test → click "share" → PNG downloads (or native share sheet opens on mobile).
2. Image is 1200×630px (correct for social OG preview size).

**Challenge mode:**
1. Complete a focused session on pattern "th".
2. "challenge a friend with 'th'" button appears → click → URL copied.
3. Open URL in new tab → app starts a focused session on "th" automatically.
4. After the focused session, URL is cleaned (no `?challenge=` in address bar).

**Multiplayer:**
1. Start backend: `uvicorn app.main:app --reload`
2. Open two browser tabs to the app.
3. In tab 1: click race icon → room created with code e.g. `AB3X9K`.
4. In tab 2: enter URL with `?room=AB3X9K`.
5. Both tabs show each other's progress bars.
6. Type in both tabs — progress bars update in real time.
7. First to 50 words sees "you won!"; second tab shows the winner's ID.
