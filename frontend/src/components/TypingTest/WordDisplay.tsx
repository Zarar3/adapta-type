import type { CharState } from '../../types';

interface LineProps {
  words: string[];
  charStates: CharState[][];
  isActive: boolean;
  activeWord: number;
  activeChar: number;
}

const stateClass: Record<CharState, string> = {
  untyped: 'text-gray-500',
  correct: 'text-gray-200',
  incorrect: 'text-red-400',
  extra: 'text-red-600',
};

export function WordDisplay({ words, charStates, isActive, activeWord, activeChar }: LineProps) {
  return (
    <div className={`flex flex-wrap gap-x-6 gap-y-4 transition-opacity duration-150 leading-relaxed ${isActive ? 'opacity-100' : 'opacity-30'}`}>
      {words.map((word, wi) => (
        <span key={wi} className="font-mono text-3xl tracking-wide relative">
          {word.split('').map((char, ci) => {
            const isCursor = isActive && wi === activeWord && ci === activeChar;
            return (
              <span
                key={ci}
                className={`relative ${stateClass[charStates[wi]?.[ci] ?? 'untyped']}`}
              >
                {isCursor && (
                  <span className="absolute -left-px top-0 h-full w-0.5 bg-yellow-400 animate-blink" />
                )}
                {char}
              </span>
            );
          })}
          {/* Cursor at end of word */}
          {isActive && wi === activeWord && activeChar >= word.length && (
            <span className="inline-block w-0.5 h-5 bg-yellow-400 animate-blink align-middle ml-px" />
          )}
        </span>
      ))}
    </div>
  );
}
