interface Props {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;
}

export function StatsBar({ wpm, rawWpm, accuracy, duration }: Props) {
  return (
    <div className="flex gap-6 sm:gap-12 justify-center mb-8 flex-wrap">
      <Stat label="wpm" value={wpm} />
      <Stat label="raw" value={rawWpm} />
      <Stat label="acc" value={`${accuracy}%`} />
      <Stat label="time" value={`${duration}s`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">{label}</div>
      <div className="text-4xl font-bold font-mono text-gray-800 dark:text-gray-100">{value}</div>
    </div>
  );
}
