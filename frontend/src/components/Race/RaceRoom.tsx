import { useEffect, useRef, useState } from 'react';

interface Player {
  progress: number;
  wpm: number;
  finished: boolean;
}

interface Bot {
  id: string;
  label: string;
  wpm: number;
  progressFloat: number;
  progress: number;
  finished: boolean;
}

type RaceType = 'players' | 'bots' | null;
type BotDifficulty = 'easy' | 'medium' | 'hard';

interface Props {
  roomId: string;
  onStart: () => void;
  wordsCompleted: number;
  currentWpm: number;
  isFinished: boolean;
  onLeave: () => void;
}

const WORD_TARGET = 50;
const BOT_COUNT = 3;
const TICK_MS = 100;

const BOT_RANGES: Record<BotDifficulty, [number, number]> = {
  easy:   [20, 70],
  medium: [30, 90],
  hard:   [40, 100],
};

const BOT_LABELS = ['typerbot', 'swiftkeys', 'dashfinger'];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeBots(difficulty: BotDifficulty): Bot[] {
  const [min, max] = BOT_RANGES[difficulty];
  return Array.from({ length: BOT_COUNT }, (_, i) => ({
    id: `bot-${i}`,
    label: BOT_LABELS[i],
    wpm: randInt(min, max),
    progressFloat: 0,
    progress: 0,
    finished: false,
  }));
}

export function RaceRoom({ roomId, onStart, wordsCompleted, currentWpm, isFinished, onLeave }: Props) {
  const [raceType, setRaceType] = useState<RaceType>(null);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [bots, setBots] = useState<Bot[]>([]);
  const [botRaceStarted, setBotRaceStarted] = useState(false);
  const [botWinner, setBotWinner] = useState<string | null>(null);

  // Multiplayer state
  const wsRef = useRef<WebSocket | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [mpWinner, setMpWinner] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // --- WebSocket (players mode only) ---
  useEffect(() => {
    if (raceType !== 'players') return;
    const backendWs = ((import.meta.env.VITE_BACKEND_URL as string) ?? '').replace(/^http/, 'ws');
    const ws = new WebSocket(`${backendWs}/race/${roomId}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as {
        type: string; playerId?: string; players?: Record<string, Player>;
      };
      if (msg.type === 'joined' && msg.playerId && !myId) setMyId(msg.playerId);
      if (msg.type === 'update' && msg.players) setPlayers(msg.players);
      if (msg.type === 'finished' && msg.players) {
        setPlayers(msg.players);
        if (!mpWinner && msg.playerId) setMpWinner(msg.playerId);
      }
    };
    return () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceType, roomId]);

  // Send progress to server (players mode)
  useEffect(() => {
    if (raceType !== 'players') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'progress', wordsCompleted, wpm: currentWpm }));
    }
  }, [raceType, wordsCompleted, currentWpm]);

  useEffect(() => {
    if (raceType !== 'players' || !isFinished) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'finished', wpm: currentWpm }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceType, isFinished]);

  // --- Bot simulation ---
  useEffect(() => {
    if (!botRaceStarted || bots.length === 0) return;

    const id = setInterval(() => {
      setBots(prev => {
        let anyWon = false;
        const updated = prev.map(bot => {
          if (bot.finished) return bot;
          const newFloat = bot.progressFloat + (bot.wpm / 60) * (TICK_MS / 1000);
          const newProgress = Math.min(Math.floor(newFloat), WORD_TARGET);
          const finished = newProgress >= WORD_TARGET;
          if (finished && !anyWon) anyWon = true;
          return { ...bot, progressFloat: newFloat, progress: newProgress, finished };
        });
        // First bot to cross the line this tick wins
        if (anyWon) {
          const winner = updated.find(b => b.finished && !prev.find(p => p.id === b.id)?.finished);
          if (winner) setBotWinner(w => w ?? winner.label);
        }
        return updated;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botRaceStarted]);

  // User finishes in bot race — check if they beat the bots
  useEffect(() => {
    if (raceType !== 'bots' || !isFinished) return;
    setBotWinner(w => w ?? 'you');
  }, [raceType, isFinished]);

  // --- Handlers ---
  const startBotRace = () => {
    setBots(makeBots(botDifficulty));
    setBotRaceStarted(true);
    onStart();
  };

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  // -----------------------------------------------------------------------
  // Selection screen
  // -----------------------------------------------------------------------
  if (raceType === null) {
    return (
      <div className="w-full max-w-md mx-auto animate-fade-in">
        <h2 className="text-center text-gray-500 dark:text-gray-400 font-mono text-sm mb-8">race mode</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setRaceType('bots')}
            className="flex flex-col items-center gap-2 p-5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-all group"
          >
            <svg className="w-6 h-6 text-gray-400 group-hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400 group-hover:text-yellow-400 transition-colors">vs bots</span>
          </button>
          <button
            onClick={() => setRaceType('players')}
            className="flex flex-col items-center gap-2 p-5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-all group"
          >
            <svg className="w-6 h-6 text-gray-400 group-hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400 group-hover:text-yellow-400 transition-colors">vs players</span>
          </button>
        </div>
        <div className="flex justify-center">
          <button onClick={onLeave} className="text-xs text-gray-500 dark:text-gray-700 hover:text-gray-400 font-mono transition-colors">← back</button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Bot race lobby / race
  // -----------------------------------------------------------------------
  if (raceType === 'bots') {
    const allEntries: Array<{ id: string; label: string; wpm: number; progress: number; finished: boolean; isMe: boolean }> = [
      { id: 'me', label: 'you', wpm: currentWpm, progress: wordsCompleted, finished: isFinished, isMe: true },
      ...bots.map(b => ({ ...b, label: b.label, isMe: false })),
    ].sort((a, b) => b.progress - a.progress);

    return (
      <div className="w-full max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-600 font-mono">vs bots</span>
            {!botRaceStarted && (
              <div className="flex gap-1">
                {(['easy', 'medium', 'hard'] as BotDifficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setBotDifficulty(d)}
                    className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                      d === botDifficulty
                        ? 'bg-yellow-400 text-gray-900'
                        : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onLeave} className="text-xs text-gray-600 dark:text-gray-700 hover:text-gray-400 font-mono transition-colors">leave</button>
        </div>

        {botWinner && (
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4 mb-6 text-center">
            <p className="text-yellow-400 font-mono font-bold">
              {botWinner === 'you' ? 'you won!' : `${botWinner} finished first`}
            </p>
          </div>
        )}

        <div className="space-y-3 mb-8">
          {allEntries.map(({ id, label, wpm, progress, finished, isMe }) => (
            <div key={id}>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className={isMe ? 'text-yellow-400' : 'text-gray-500 dark:text-gray-600'}>
                  {label}{finished && ' ✓'}
                </span>
                <span className="text-gray-600 dark:text-gray-700">
                  {isMe ? (wpm > 0 ? `${wpm} wpm · ` : '') : `${wpm} wpm · `}
                  {progress}/{WORD_TARGET}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${isMe ? 'bg-yellow-400' : 'bg-gray-500 dark:bg-gray-600'}`}
                  style={{ width: `${Math.min((progress / WORD_TARGET) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {!botRaceStarted && (
          <div className="flex justify-center">
            <button
              onClick={startBotRace}
              className="px-6 py-2.5 rounded bg-yellow-400 text-gray-900 font-medium hover:bg-yellow-300 transition-colors"
            >
              start race
            </button>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Multiplayer room
  // -----------------------------------------------------------------------
  const playerList = Object.entries(players).sort(([, a], [, b]) => b.progress - a.progress);

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-600 font-mono mb-1">room code</p>
          <p className="text-yellow-400 font-mono font-bold text-xl tracking-widest">{roomId}</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          className="text-xs text-gray-500 hover:text-yellow-400 font-mono transition-colors"
        >
          {linkCopied ? 'copied!' : 'copy invite link'}
        </button>
        <button onClick={onLeave} className="text-xs text-gray-600 dark:text-gray-700 hover:text-gray-400 font-mono transition-colors">leave</button>
      </div>

      {!connected && (
        <p className="text-yellow-400/60 text-sm font-mono mb-4">connecting...</p>
      )}

      {mpWinner && (
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4 mb-6 text-center">
          <p className="text-yellow-400 font-mono font-bold">
            {mpWinner === myId ? 'you won!' : `player ${mpWinner.slice(0, 4)} finished first`}
          </p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {playerList.map(([id, p]) => (
          <div key={id}>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className={id === myId ? 'text-yellow-400' : 'text-gray-500 dark:text-gray-600'}>
                {id === myId ? 'you' : `player ${id.slice(0, 4)}`}{p.finished && ' ✓'}
              </span>
              <span className="text-gray-600 dark:text-gray-700">{p.wpm} wpm · {p.progress}/{WORD_TARGET}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${id === myId ? 'bg-yellow-400' : 'bg-gray-500 dark:bg-gray-600'}`}
                style={{ width: `${Math.min((p.progress / WORD_TARGET) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
        {playerList.length === 0 && connected && (
          <p className="text-xs text-gray-500 dark:text-gray-600 font-mono">waiting for players... share the room code above</p>
        )}
      </div>

      {connected && (
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
