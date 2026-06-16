import { useEffect, useRef, useState } from 'react';

interface Props {
  score: number;
  combo: number;
  multiplier: number;
  goldenMode: boolean;
  goldenTimeLeft: number;
  accMult: number;
  wpmMult: number;
  diffMult: number;
  freezeLeft: number;
}

const TONE_COLOR = { green: 'text-green-400', sky: 'text-sky-300', amber: 'text-orange-400' };

// A live multiplier badge that dims at 1× and brightens + flashes when its tier rises.
function MultBadge({ label, mult, tone }: { label: string; mult: number; tone: keyof typeof TONE_COLOR }) {
  const [flashKey, setFlashKey] = useState(0);
  const prev = useRef(mult);
  useEffect(() => {
    if (mult > prev.current) setFlashKey(k => k + 1);
    prev.current = mult;
  }, [mult]);

  const active = mult > 1;
  const activeColor = TONE_COLOR[tone];

  return (
    <div className="flex items-center gap-1 text-xs font-mono leading-none">
      <span className="text-gray-600">{label}</span>
      <span
        key={flashKey}
        className={`font-bold ${active ? `${activeColor} ${flashKey ? 'animate-flash' : ''}` : 'text-gray-700'}`}
      >
        {mult}×
      </span>
    </div>
  );
}

export function SurviveHUD({ score, combo, multiplier, goldenMode, goldenTimeLeft, accMult, wpmMult, diffMult, freezeLeft }: Props) {
  return (
    <div className="relative flex items-center justify-between mb-3 px-1">
      {/* Score */}
      <div className="font-mono leading-none">
        <span className="text-2xl font-bold text-yellow-400">{score}</span>
        <span className="text-xs text-gray-500 ml-1">pts</span>
      </div>

      {/* Combo + multiplier */}
      <div className="text-xs font-mono text-gray-500 min-w-[80px] text-center">
        {combo > 0 && (
          <>
            <span className="text-gray-300">{combo}</span>
            <span className="text-gray-600"> combo</span>
            {multiplier > 1 && (
              <span className="text-yellow-400 ml-1 font-bold">{multiplier}×</span>
            )}
          </>
        )}
      </div>

      {/* Live wpm / accuracy multipliers + golden indicator */}
      <div className="flex items-center gap-3">
        <MultBadge label="wpm" mult={wpmMult} tone="sky" />
        <MultBadge label="acc" mult={accMult} tone="green" />
        <MultBadge label="diff" mult={diffMult} tone="amber" />
        {freezeLeft > 0 && (
          <span className="text-xs font-mono text-sky-300 font-bold animate-pulse">
            ❄ {freezeLeft}s
          </span>
        )}
        {goldenMode && (
          <span className="text-xs font-mono text-yellow-400 font-bold animate-pulse">
            ✦ {goldenTimeLeft}s
          </span>
        )}
      </div>

      {/* Golden mode progress bar */}
      {goldenMode && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800 rounded overflow-hidden">
          <div
            className="h-full bg-yellow-400 transition-all duration-1000 ease-linear"
            style={{ width: `${(goldenTimeLeft / 5) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
