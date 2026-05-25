interface Props {
  view: 'typing' | 'wall';
  onToggleView: () => void;
}

export function Header({ view, onToggleView }: Props) {
  return (
    <header className="flex items-center justify-between px-8 py-5">
      <span className="text-2xl font-bold tracking-tight text-yellow-400">
        adapta<span className="text-gray-300">type</span>
      </span>
      <button
        onClick={onToggleView}
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        {view === 'typing' ? 'pattern wall' : '← back'}
      </button>
    </header>
  );
}
