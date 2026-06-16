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
  accuracy: number;
  accuracyMin: number;
  accuracyMax: number;
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

const ACCURACY_RANGES: Record<BotDifficulty, [number, number]> = {
  easy:   [40, 60],
  medium: [60, 70],
  hard:   [70, 90],
};

const BOT_LABELS = ['typerbot', 'swiftkeys', 'dashfinger'];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function makeBots(difficulty: BotDifficulty): Bot[] {
  const [wMin, wMax] = BOT_RANGES[difficulty];
  const [aMin, aMax] = ACCURACY_RANGES[difficulty];
  return Array.from({ length: BOT_COUNT }, (_, i) => ({
    id: `bot-${i}`,
    label: BOT_LABELS[i],
    wpm: randInt(wMin, wMax),
    accuracy: randInt(aMin, aMax),
    accuracyMin: aMin,
    accuracyMax: aMax,
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
  const [placements, setPlacements] = useState<string[]>([]);

  // Multiplayer state
  const wsRef = useRef<WebSocket | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [mpPlacements, setMpPlacements] = useState<string[]>([]);
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
      if (msg.type === 'finished' && msg.players && msg.playerId) {
        setPlayers(msg.players);
        setMpPlacements(p => p.includes(msg.playerId!) ? p : [...p, msg.playerId!]);
      }
    };
    return () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceType, roomId]);

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
      // Collect newly finished labels outside the setBots updater
      let newlyFinished: string[] = [];

      setBots(prev => {
        const updated = prev.map(bot => {
          if (bot.finished) return bot;
          // Accuracy drifts ±2% each tick, clamped to bot's range
          const accDelta = (Math.random() - 0.5) * 4;
          const newAcc = Math.max(bot.accuracyMin, Math.min(bot.accuracyMax, bot.accuracy + accDelta));
          const effectiveWpm = bot.wpm * (newAcc / 100);
          const newFloat = bot.progressFloat + (effectiveWpm / 60) * (TICK_MS / 1000);
          const newProgress = Math.min(Math.floor(newFloat), WORD_TARGET);
          const finished = newProgress >= WORD_TARGET;
          if (finished) newlyFinished.push(bot.label);
          return { ...bot, accuracy: newAcc, progressFloat: newFloat, progress: newProgress, finished };
        });
        return updated;
      });

      if (newlyFinished.length > 0) {
        setPlacements(p => {
          const next = [...p];
          for (const label of newlyFinished) {
            if (!next.includes(label)) next.push(label);
          }
          return next;
        });
      }
    }, TICK_MS);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botRaceStarted]);

  // User finishes in bot race
  useEffect(() => {
    if (raceType !== 'bots' || !isFinished) return;
    setPlacements(p => p.includes('you') ? p : [...p, 'you']);
  }, [raceType, isFinished]);

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
  // Bot race
  // -----------------------------------------------------------------------
  if (raceType === 'bots') {
    const allEntries = [
      { id: 'me', label: 'you', wpm: currentWpm, progress: wordsCompleted, finished: isFinished, isMe: true, accuracy: null as number | null },
      ...bots.map(b => ({ id: b.id, label: b.label, wpm: Math.round(b.wpm * (b.accuracy / 100)), progress: b.progress, finished: b.finished, isMe: false, accuracy: Math.round(b.accuracy) })),
    ].sort((a, b) => b.progress - a.progress);

    return (
      <div className="w-full max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-4">
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

        {placements.length > 0 && (
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-3 mb-4">
            <div className="flex gap-4 flex-wrap">
              {placements.map((label, i) => (
                <span key={label} className={`font-mono text-sm ${i === 0 ? 'text-yellow-400 font-bold' : 'text-gray-500 dark:text-gray-500'}`}>
                  {ordinal(i + 1)} {label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 mb-6">
          {allEntries.map(({ id, label, wpm, progress, finished, isMe, accuracy }) => {
            const placement = placements.indexOf(label);
            return (
              <div key={id}>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className={isMe ? 'text-yellow-400' : 'text-gray-500 dark:text-gray-600'}>
                    {label}
                    {finished && placement !== -1 && (
                      <span className="ml-1.5 text-gray-600 dark:text-gray-700">{ordinal(placement + 1)}</span>
                    )}
                  </span>
                  <span className="text-gray-600 dark:text-gray-700">
                    {wpm > 0 ? `${wpm} wpm · ` : ''}{accuracy !== null ? `${accuracy}% acc · ` : ''}{progress}/{WORD_TARGET}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-100 ${isMe ? 'bg-yellow-400' : 'bg-gray-500 dark:bg-gray-600'}`}
                    style={{ width: `${Math.min((progress / WORD_TARGET) * 100, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {!botRaceStarted && (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={startBotRace}
              className="px-6 py-2.5 rounded bg-yellow-400 text-gray-900 font-medium hover:bg-yellow-300 transition-colors"
            >
              start race
            </button>
            <p className="text-xs font-mono text-gray-600 dark:text-gray-700">you must type each word correctly before advancing</p>
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

      {mpPlacements.length > 0 && (
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-3 mb-4">
          <div className="flex gap-4 flex-wrap">
            {mpPlacements.map((id, i) => (
              <span key={id} className={`font-mono text-sm ${i === 0 ? 'text-yellow-400 font-bold' : 'text-gray-500 dark:text-gray-500'}`}>
                {ordinal(i + 1)} {id === myId ? 'you' : `player ${id.slice(0, 4)}`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {playerList.map(([id, p]) => {
          const placement = mpPlacements.indexOf(id);
          return (
            <div key={id}>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className={id === myId ? 'text-yellow-400' : 'text-gray-500 dark:text-gray-600'}>
                  {id === myId ? 'you' : `player ${id.slice(0, 4)}`}
                  {p.finished && placement !== -1 && (
                    <span className="ml-1.5 text-gray-600 dark:text-gray-700">{ordinal(placement + 1)}</span>
                  )}
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
          );
        })}
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
