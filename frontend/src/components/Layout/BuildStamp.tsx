/**
 * Version badge in the bottom-right corner. The patch number is bumped by the
 * .githooks/pre-commit hook, so it identifies a distinct build without anyone
 * remembering to bump it. Hover shows the exact commit and build time, which is
 * what you actually want when chasing down "which build is this?".
 */
export function BuildStamp() {
  const builtAt = new Date(__APP_BUILT_AT__);
  const stamp = isNaN(builtAt.getTime()) ? __APP_BUILT_AT__ : builtAt.toLocaleString();

  return (
    <span
      title={`commit ${__APP_COMMIT__} · built ${stamp}`}
      className="fixed bottom-2 right-3 z-10 select-none font-mono text-[10px]
                 text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500
                 transition-colors"
    >
      v{__APP_VERSION__}
    </span>
  );
}
