interface Props {
  view: 'typing' | 'wall';
  onToggleView: () => void;
  onLogoClick: () => void;
}

export function Header({ view, onToggleView, onLogoClick }: Props) {
  return (
    <header className="flex items-center justify-between px-8 py-5">
      <button onClick={onLogoClick} className="text-2xl font-bold tracking-tight text-yellow-400 hover:opacity-80 transition-opacity">
        adapta<span className="text-gray-300">type</span>
      </button>
      <button
        onClick={onToggleView}
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        {view === 'typing' ? 'pattern wall' : '← back'}
      </button>
    </header>
  );
}
