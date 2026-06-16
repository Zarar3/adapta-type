import { useEffect, useRef, useState } from 'react';

interface Player {
  progress: number;
  wpm: number;
  finished: boolean;
}

interface Props {
  roomId: string;
  onStart: () => void;
  wordsCompleted: number;
  currentWpm: number;
  isFinished: boolean;
  onLeave: () => void;
}

const WORD_TARGET = 50;

export function RaceRoom({ roomId, onStart, wordsCompleted, currentWpm, isFinished, onLeave }: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const backendWs = (import.meta.env.VITE_BACKEND_URL as string).replace(/^http/, 'ws');

  useEffect(() => {
    const ws = new WebSocket(`${backendWs}/race/${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as {
        type: string;
        playerId?: string;
        total?: number;
        players?: Record<string, Player>;
        wpm?: number;
      };
      if (msg.type === 'joined' && msg.playerId && !myId) setMyId(msg.playerId);
      if (msg.type === 'update' && msg.players) setPlayers(msg.players);
      if (msg.type === 'finished' && msg.players) {
        setPlayers(msg.players);
        if (!winner && msg.playerId) setWinner(msg.playerId);
      }
    };

    return () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Send progress update on every word
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
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
        <button onClick={onLeave} className="text-xs text-gray-600 hover:text-gray-400 dark:text-gray-700 dark:hover:text-gray-500 font-mono transition-colors">
          leave
        </button>
      </div>

      {!connected && (
        <p className="text-yellow-400/60 text-sm font-mono mb-4">connecting...</p>
      )}

      {winner && (
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4 mb-6 text-center">
          <p className="text-yellow-400 font-mono font-bold">
            {winner === myId ? 'you won!' : `player ${winner.slice(0, 4)} finished first`}
          </p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {playerList.map(([id, p]) => (
          <div key={id}>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className={id === myId ? 'text-yellow-400' : 'text-gray-500 dark:text-gray-600'}>
                {id === myId ? 'you' : `player ${id.slice(0, 4)}`}
                {p.finished && ' ✓'}
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
