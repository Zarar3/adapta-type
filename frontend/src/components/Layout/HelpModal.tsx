import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Plain-language explanation of the adaptive system. Deliberately non-technical:
 * no "n-gram", no thresholds, no numbers the user would have to reason about.
 * If the detection constants in ngramTracker.ts change, the wording here
 * ("more than about one try in seven", "half again as long") should follow.
 */
export function HelpModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Pull focus off the hidden typing input, otherwise keystrokes meant for the
    // dialog would start a test running behind it.
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl p-6 shadow-2xl
                   bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
        onClick={e => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="close"
          className="absolute top-3 right-4 text-2xl leading-none text-gray-400 hover:text-gray-700
                     dark:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          ×
        </button>

        <h2 id="help-title" className="text-lg font-bold mb-1 text-gray-900 dark:text-gray-100">
          How it
          <span className="font-mono text-yellow-500 dark:text-yellow-400"> adapts</span> to you
        </h2>
         

        <div className="space-y-5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">it watches letter pairs, not words</h3>
            <p>
              The hard part of typing isn't words, it's the little jumps between keys, the
              <span className="font-mono text-yellow-500 dark:text-yellow-400"> th</span> in "the", the
              <span className="font-mono text-yellow-500 dark:text-yellow-400"> rd</span> in "word". Every key you press,
              it's looking at the jump you just made.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Two things make a pair stand out</h3>
            <p className="mb-2">
              <span className="text-gray-800 dark:text-gray-200">You keep getting it wrong.</span> Not once, a slip is
              just a slip. It waits until you've had a few goes at that pair and you're still missing it.
            </p>
            <p>
              <span className="text-gray-800 dark:text-gray-200">You keep slowing down.</span> Even when you get it
              right, it's timing you. If one pair regularly takes half again as long as your own usual rhythm, that's a
              hesitation that adaptatype tracks.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Then it quietly feeds you more</h3>
            <p>
              The pair appears above the words, and the words you get next start containing it. For example, if your struggling with "th" you just find yourself typing a lot of words with
              <span className="font-mono text-yellow-500 dark:text-yellow-400"> th</span> in them.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">And it lets go</h3>
            <p>
              Get a pair right a few times in a row and it drops off (longer tests ask for a longer streak). 
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">only three at a time</h3>
            <p>
              It notices more than it shows you. The rest wait their turn for you to get the current ones right. 
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">it stays on your machine</h3>
            <p>
              Everything it learns about your typing lives in your own browser. No account, nothing to sign up for.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
