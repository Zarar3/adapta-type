import type { PatternRecord } from '../../hooks/usePatternLibrary';

interface Props {
  library: Record<string, PatternRecord>;
  onPractice: (pattern: string) => void;
}

export function PatternWall({ library, onPractice }: Props) {
  const entries = Object.values(library).sort((a, b) => b.totalErrors - a.totalErrors);

  if (entries.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-24">
        <p className="text-gray-600 text-lg">no patterns yet</p>
        <p className="text-gray-700 text-sm mt-2">complete a typing test to start building your wall</p>
      </div>
    );
  }

  const pending = entries.filter(e => !e.completed);
  const done = entries.filter(e => e.completed);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {pending.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-5">needs practice</h2>
          <div className="flex flex-wrap gap-3">
            {pending.map(p => (
              <button
                key={p.pattern}
                onClick={() => onPractice(p.pattern)}
                className="flex flex-col items-center gap-1.5 px-5 py-4 rounded-lg bg-gray-900 border border-gray-800 hover:border-yellow-400/40 hover:bg-gray-800 transition-colors group"
              >
                <span className="font-mono text-2xl text-gray-200 tracking-widest">{p.pattern}</span>
                {p.totalErrors > 0 && (
                  <span className="text-xs text-red-400">×{p.totalErrors} errors</span>
                )}
                <span className="text-xs text-gray-700 group-hover:text-gray-500 transition-colors">practice</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-5">completed</h2>
          <div className="flex flex-wrap gap-3">
            {done.map(p => (
              <button
                key={p.pattern}
                onClick={() => onPractice(p.pattern)}
                className="flex flex-col items-center gap-1.5 px-5 py-4 rounded-lg bg-green-400/5 border border-green-400/20 hover:border-green-400/40 transition-colors group"
              >
                <span className="font-mono text-2xl text-green-300 tracking-widest">{p.pattern}</span>
                <span className="text-xs text-green-600">✓ done</span>
                <span className="text-xs text-gray-700 group-hover:text-gray-500 transition-colors">redo</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
