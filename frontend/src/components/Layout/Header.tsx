interface Props {
  view: 'typing' | 'wall';
  onToggleView: () => void;
  onLogoClick: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function Header({ view, onToggleView, onLogoClick, soundEnabled, onToggleSound }: Props) {
  return (
    <header className="flex items-center justify-between px-8 py-5">
      <button onClick={onLogoClick} className="text-2xl font-bold tracking-tight text-yellow-400 hover:opacity-80 transition-opacity">
        adapta<span className="text-gray-300">type</span>
      </button>
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'mute sound' : 'enable sound'}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          {soundEnabled ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M9 12H5l-2-2v4l2-2h4m8-6l2-2v12l-2-2" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>
        <button
          onClick={onToggleView}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          {view === 'typing' ? 'pattern wall' : '← back'}
        </button>
      </div>
    </header>
  );
}
