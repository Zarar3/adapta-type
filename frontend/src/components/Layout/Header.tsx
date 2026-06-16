interface Props {
  view: 'typing' | 'wall' | 'race';
  onToggleView: () => void;
  onLogoClick: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onCreateRoom: () => void;
}

export function Header({ view, onToggleView, onLogoClick, soundEnabled, onToggleSound, theme, onToggleTheme, onCreateRoom }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
      <button onClick={onLogoClick} className="text-2xl font-bold tracking-tight text-yellow-400 hover:opacity-80 transition-opacity">
        adapta<span className="text-gray-600 dark:text-gray-300">type</span>
      </button>
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'mute sound' : 'enable sound'}
          className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
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

        {/* Sun = currently dark, click to go light. Moon = currently light, click to go dark. */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
          className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>

        <button
          onClick={onCreateRoom}
          title="multiplayer race"
          className={`transition-colors ${view === 'race' ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>

        <button
          onClick={onToggleView}
          className="text-sm text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          {view === 'typing' ? 'pattern wall' : '← back'}
        </button>
      </div>
    </header>
  );
}
