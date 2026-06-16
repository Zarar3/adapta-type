interface Props {
  score: number;
  combo: number;
  multiplier: number;
  goldenMode: boolean;
  goldenTimeLeft: number;
}

export function SurviveHUD({ score, combo, multiplier, goldenMode, goldenTimeLeft }: Props) {
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

      {/* Golden mode indicator */}
      <div className="min-w-[60px] text-right">
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
