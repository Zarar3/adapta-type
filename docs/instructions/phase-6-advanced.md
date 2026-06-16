# Phase 6 — Advanced: Implementation Instructions

> **Self-contained.** Read this file only. Implement features in the order listed.
> Features 3 (code mode) requires Phase 2 (`GameMode`) to be complete.
> After each feature, run `cd frontend && npx tsc --noEmit`.

---

## What This Phase Adds

1. **PWA** — installable as an app, offline support with banner
2. **Language packs** — English / Spanish / French / German word lists, hot-swappable
3. **Code typing mode** — type real code snippets in JS/Python/Rust/Go
4. **Smarter difficulty scoring** — replace static per-key heuristic with bigram-aware scoring

---

## Codebase Snapshot (before changes)

### `frontend/package.json` — current devDependencies (relevant)

```json
{
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "@vitejs/plugin-react": "^6.0.1",
    "vite": "^8.0.12",
    "typescript": "~6.0.2"
  }
}
```

### `frontend/vite.config.ts` — read this file before editing

File path: `frontend/vite.config.ts`. Read it to understand the current plugin list before adding `VitePWA`.

### `frontend/src/lib/wordSelector.ts` — full current exports and key implementation

```ts
// Key data structures
const KEY_SCORE: Record<string, number>  // per-key ergonomic difficulty
const FINGER: Record<string, number>     // key → finger index (0-7)
const SAME_FINGER_PENALTY = 2.5

const COMMON_POOL_SIZE = 1500
const DIFFICULTY_TIERS: string[][] = [/* 4 tiers */]  // computed once at module load

// Exports
export function hasSufficientCoverage(pattern: string): boolean
export function getProactiveBigrams(count?: number): string[]
export function generateWord(ngrams, difficulty, exclude, bias): string
export function generateLine(ngrams, count, difficulty): string[]

// Internal scoring function that currently uses per-character KEY_SCORE loop:
function wordTypingScore(word: string): number {
  let keyTotal = 0;
  for (let i = 0; i < word.length; i++) {
    keyTotal += KEY_SCORE[word[i]] ?? 1.5;
    if (i > 0 && FINGER[word[i]] !== undefined && FINGER[word[i-1]] !== undefined
        && FINGER[word[i]] === FINGER[word[i-1]]) {
      keyTotal += SAME_FINGER_PENALTY;
    }
  }
  return keyTotal * 0.6 + word.length * 0.4;
}
```

### `frontend/src/data/wordlist.ts` — structure

```ts
export const WORD_LIST: string[] = ["the", "and", "for", ...] // ~5000 words, frequency-ordered
```

### `frontend/src/components/Layout/Header.tsx` — current props

```ts
interface Props {
  view: 'typing' | 'wall';
  onToggleView: () => void;
  onLogoClick: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}
```

### localStorage keys in use (do not conflict)

```
adapta-type-timing, adapta-type-flagged-slow, adapta-type-struggling,
adapta-type-patterns, adapta-type-session-count, adapta-type-sound,
adapta-type-theme, adapta-type-active-ngrams, adapta-type-history
```

---

## Feature 1 — PWA (Progressive Web App)

### Step 1a — Install the plugin

```bash
cd frontend
npm install -D vite-plugin-pwa
```

### Step 1b — Update `frontend/vite.config.ts`

Read the file first, then add `VitePWA` to the plugins array:

```ts
import { VitePWA } from 'vite-plugin-pwa';

// In the plugins array alongside the existing plugins:
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg'],
  manifest: {
    name: 'Adapta-Type',
    short_name: 'AdaptaType',
    description: 'Adaptive typing trainer that learns your weak letter combinations.',
    theme_color: '#030712',
    background_color: '#030712',
    display: 'standalone',
    start_url: '/',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
      },
    ],
  },
})
```

### Step 1c — Offline banner in `frontend/src/App.tsx`

Add state and effect:
```ts
const [isOffline, setIsOffline] = useState(!navigator.onLine);

useEffect(() => {
  const goOffline = () => setIsOffline(true);
  const goOnline  = () => setIsOffline(false);
  window.addEventListener('offline', goOffline);
  window.addEventListener('online',  goOnline);
  return () => {
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online',  goOnline);
  };
}, []);
```

Add banner just inside the root div, before `<Header>`:
```tsx
{isOffline && (
  <div className="text-center text-xs font-mono py-1.5 bg-yellow-400/10 text-yellow-400/70 border-b border-yellow-400/20">
    offline — results won't be saved to the server
  </div>
)}
```

Note: The `finishTest` function in `useTypingEngine.ts` already wraps the backend POST in `.catch(() => {})`, so offline is safe with no additional changes.

---

## Feature 2 — Language Packs

### Step 2a — Restructure word data

Create `frontend/src/data/wordlists/` folder.

**`frontend/src/data/wordlists/en.ts`** — re-export the existing list:
```ts
export { WORD_LIST as EN_WORDS } from '../wordlist';
```

**`frontend/src/data/wordlists/es.ts`** — 1500 most common Spanish words:
```ts
export const ES_WORDS: string[] = [
  "que", "de", "no", "a", "la", "el", "es", "y", "en", "lo",
  "un", "por", "qué", "me", "una", "te", "los", "se", "con", "las",
  // ... continue to ~1500 common Spanish words (use only a-z lowercase, no accents for typeability)
];
```

For typeability, strip accents from Spanish/French/German words so they're typeable on a standard QWERTY keyboard:
- Spanish: `señor` → `senor`, `también` → `tambien`
- French: `être` → `etre`, `ça` → `ca`
- German: `über` → `uber`, `straße` → `strasse`

**`frontend/src/data/wordlists/fr.ts`** — 1500 most common French words (accent-stripped):
```ts
export const FR_WORDS: string[] = ["le", "de", "un", "a", "et", "est", "en", "que", "du", "il", ...];
```

**`frontend/src/data/wordlists/de.ts`** — 1500 most common German words (umlaut-stripped):
```ts
export const DE_WORDS: string[] = ["der", "die", "und", "in", "den", "von", "zu", "das", "mit", "sich", ...];
```

### Step 2b — New type and localStorage key

Add to `frontend/src/types/index.ts`:
```ts
export type Language = 'en' | 'es' | 'fr' | 'de';
```

New localStorage key: `adapta-type-language` → `Language` (default `'en'`).

### Step 2c — Language switching in `frontend/src/lib/wordSelector.ts`

Add at the top of the file:
```ts
import type { Language } from '../types';
import { EN_WORDS } from '../data/wordlists/en';

// Mutable word pool — swapped by setLanguage()
let _activeWordList = EN_WORDS;
let _difficultyTiers: string[][] = buildTiers(EN_WORDS);

function buildTiers(wordList: string[]): string[][] {
  const pool = wordList.slice(0, 1500);
  const scored = pool.map(w => [w, wordTypingScore(w)] as [string, number]).sort((a, b) => a[1] - b[1]);
  const n = scored.length;
  return [
    scored.slice(0, Math.floor(n * 0.30)).map(([w]) => w),
    scored.slice(Math.floor(n * 0.30), Math.floor(n * 0.60)).map(([w]) => w),
    scored.slice(Math.floor(n * 0.60), Math.floor(n * 0.80)).map(([w]) => w),
    scored.slice(Math.floor(n * 0.80)).map(([w]) => w),
  ];
}

export async function setLanguage(lang: Language): Promise<void> {
  try { localStorage.setItem('adapta-type-language', lang); } catch { /* silent */ }
  // Lazy-load the word list for the chosen language
  const map: Record<Language, () => Promise<{ default: string[] } | { [k: string]: string[] }>> = {
    en: () => import('../data/wordlists/en').then(m => ({ default: m.EN_WORDS })),
    es: () => import('../data/wordlists/es').then(m => ({ default: m.ES_WORDS })),
    fr: () => import('../data/wordlists/fr').then(m => ({ default: m.FR_WORDS })),
    de: () => import('../data/wordlists/de').then(m => ({ default: m.DE_WORDS })),
  };
  const mod = await map[lang]();
  const words = (mod as { default: string[] }).default;
  _activeWordList = words;
  _difficultyTiers = buildTiers(words);
}

export function getActiveLanguage(): Language {
  try { return (localStorage.getItem('adapta-type-language') as Language) ?? 'en'; } catch { return 'en'; }
}
```

Replace the existing module-level `_scored`/`_n`/`DIFFICULTY_TIERS` constants with `_difficultyTiers` from `buildTiers(EN_WORDS)`.

Update `generateWord` and `generateLine` to use `_difficultyTiers` and `_activeWordList` instead of the old `DIFFICULTY_TIERS` and `WORD_LIST`.

Update `hasSufficientCoverage` to use `_activeWordList`.

### Step 2d — Language initialisation in `frontend/src/main.tsx`

```ts
import { setLanguage, getActiveLanguage } from './lib/wordSelector';

// Before rendering, load the saved language
setLanguage(getActiveLanguage()).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
});
```

### Step 2e — Language picker in `Header.tsx`

Add to `Props`:
```ts
language: Language;
onChangeLanguage: (l: Language) => void;
```

Add flag buttons in the nav (between theme and wall toggle):
```tsx
const FLAGS: Record<Language, string> = { en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪' };

{(['en', 'es', 'fr', 'de'] as Language[]).map(l => (
  <button
    key={l}
    onClick={() => onChangeLanguage(l)}
    title={l}
    className={`text-sm transition-opacity ${language === l ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
  >
    {FLAGS[l]}
  </button>
))}
```

Wire in `App.tsx`:
```ts
const [language, setLanguage_] = useState<Language>(getActiveLanguage);
const handleChangeLanguage = useCallback(async (l: Language) => {
  await setLanguage(l);   // from wordSelector.ts
  setLanguage_(l);
  reset();                // restart with new word pool
}, [reset]);
```

---

## Feature 3 — Code Typing Mode

### Step 3a — New data file: `frontend/src/data/codeSnippets.ts`

```ts
export interface CodeSnippet {
  text: string;
  language: 'js' | 'py' | 'rust' | 'go';
}

export const CODE_SNIPPETS: CodeSnippet[] = [
  { language: 'js', text: 'const greet = name => `hello, ${name}`;' },
  { language: 'js', text: 'const sum = arr.reduce((a, b) => a + b, 0);' },
  { language: 'js', text: 'const unique = arr => [...new Set(arr)];' },
  { language: 'js', text: 'async function fetchData(url) { const res = await fetch(url); return res.json(); }' },
  { language: 'js', text: 'const clamp = (n, min, max) => Math.min(Math.max(n, min), max);' },
  { language: 'js', text: 'const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };' },
  { language: 'py', text: 'def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)' },
  { language: 'py', text: 'squares = [x**2 for x in range(10) if x % 2 == 0]' },
  { language: 'py', text: 'with open("file.txt", "r") as f: data = f.read()' },
  { language: 'py', text: 'result = sorted(items, key=lambda x: x["score"], reverse=True)' },
  { language: 'py', text: 'counts = {word: words.count(word) for word in set(words)}' },
  { language: 'rust', text: 'fn add(a: i32, b: i32) -> i32 { a + b }' },
  { language: 'rust', text: 'let names: Vec<String> = vec!["alice", "bob"].iter().map(|s| s.to_string()).collect();' },
  { language: 'rust', text: 'if let Some(value) = map.get("key") { println!("{}", value); }' },
  { language: 'rust', text: 'let evens: Vec<i32> = (0..10).filter(|x| x % 2 == 0).collect();' },
  { language: 'go', text: 'func add(a, b int) int { return a + b }' },
  { language: 'go', text: 'for i, v := range slice { fmt.Println(i, v) }' },
  { language: 'go', text: 'if err != nil { return fmt.Errorf("failed: %w", err) }' },
  { language: 'go', text: 'result := make(chan int); go func() { result <- compute() }()' },
  // ... add ~40 more snippets across all 4 languages
];
```

Only use characters typeable without modifier keys: letters, digits, spaces, `=`, `+`, `-`, `*`, `/`, `(`, `)`, `[`, `]`, `{`, `}`, `.`, `,`, `;`, `:`, `_`, `"`, `'`, `` ` ``, `!`, `<`, `>`, `|`, `&`, `%`, `#`, `@`, `?`. No tab characters (use spaces).

### Step 3b — Extend `GameMode` type

In `frontend/src/types/index.ts`, change:
```ts
export type GameMode = 'timed' | 'words' | 'quote' | 'custom' | 'code';
```

### Step 3c — Wire into the engine (`useTypingEngine.ts`)

Add new session starter:
```ts
const startCodeSession = useCallback(() => {
  stopTicker();
  secondCountRef.current = 0;
  // Pick a random snippet; split on spaces for the word list
  const { CODE_SNIPPETS } = await import('../data/codeSnippets');
  const snippet = CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
  const words = snippet.text.split(' ').filter(Boolean);
  setDuration('infinite');
  setState({
    ...buildInitialState('infinite', 'code', { fixedWords: words }),
  });
}, [stopTicker]);
```

Note: because `startCodeSession` uses dynamic import, make it `async` and handle it in the caller. Alternatively, import `CODE_SNIPPETS` statically at the top of the file — the bundle size impact is small (~10KB).

Export `startCodeSession` from the hook's return object.

### Step 3d — UI changes

**TimerBar.tsx / mode tab bar:** Add `'code'` to the mode list:
```tsx
{(['timed', 'words', 'quote', 'custom', 'code'] as GameMode[]).map(m => (...))}
```

**WordDisplay.tsx:** When `gameMode === 'code'`, apply a slightly smaller font and a faint code-style background:
Pass `isCodeMode: boolean` prop to `WordDisplay`. When true:
```tsx
className={`font-mono ${isCodeMode ? 'text-sm sm:text-base' : 'text-xl sm:text-3xl'} tracking-wide ...`}
```

The word display container gets a subtle background:
```tsx
{isCodeMode && (
  <div className="absolute inset-0 -mx-4 -my-2 bg-gray-900/50 rounded-lg border border-gray-800" />
)}
```

---

## Feature 4 — Smarter Difficulty Scoring

### Concept

The current `wordTypingScore` function sums per-character key difficulty and adds a same-finger penalty. It doesn't account for the directional stretch between consecutive keys. This feature adds a `stretch penalty` based on the row distance between adjacent keys.

### Changes to `frontend/src/lib/wordSelector.ts`

Add key-row lookup:
```ts
// 0 = bottom row, 1 = home row, 2 = top row
const KEY_ROW: Record<string, number> = {
  z: 0, x: 0, c: 0, v: 0, b: 0, n: 0, m: 0,
  a: 1, s: 1, d: 1, f: 1, g: 1, h: 1, j: 1, k: 1, l: 1,
  q: 2, w: 2, e: 2, r: 2, t: 2, y: 2, u: 2, i: 2, o: 2, p: 2,
};

const KEY_COL: Record<string, number> = {
  q: 0, a: 0, z: 0,
  w: 1, s: 1, x: 1,
  e: 2, d: 2, c: 2,
  r: 3, f: 3, v: 3,
  t: 4, g: 4, b: 4,
  y: 5, h: 5, n: 5,
  u: 6, j: 6, m: 6,
  i: 7, k: 7,
  o: 8, l: 8,
  p: 9,
};
```

Replace `wordTypingScore`:
```ts
function wordTypingScore(word: string): number {
  if (word.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    total += KEY_SCORE[ch] ?? 1.5;

    if (i > 0) {
      const prev = word[i - 1];
      // Same-finger penalty (unchanged)
      if (FINGER[ch] !== undefined && FINGER[prev] !== undefined && FINGER[ch] === FINGER[prev]) {
        total += SAME_FINGER_PENALTY;
      }
      // Stretch penalty: row distance between consecutive keys
      const rowDist = Math.abs((KEY_ROW[ch] ?? 1) - (KEY_ROW[prev] ?? 1));
      const colDist = Math.abs((KEY_COL[ch] ?? 4) - (KEY_COL[prev] ?? 4));
      if (rowDist >= 2 || colDist >= 5) {
        total += 1.2; // large stretch
      } else if (rowDist >= 1 && colDist >= 3) {
        total += 0.6; // moderate stretch
      }
    }
  }
  // 55% key+stretch difficulty, 45% word length
  return total * 0.55 + word.length * 0.45;
}
```

This change only affects `DIFFICULTY_TIERS` computation (which happens at module load time via `buildTiers`). No other code changes needed. The word list and n-gram logic are unaffected.

After this change, rebuild the difficulty tiers by calling `buildTiers(EN_WORDS)` (which uses the updated `wordTypingScore` automatically since both are in the same module).

---

## Verification

```bash
cd frontend && npx tsc --noEmit
npm run build                    # ensure PWA plugin doesn't break the build
npm run test
```

Manual smoke tests:

**PWA:**
1. `npm run build && npm run preview`
2. Open Chrome DevTools → Application → Service Workers — service worker registered.
3. Application → Manifest — shows Adapta-Type name, theme color `#030712`.
4. Turn off WiFi → app still loads from cache.
5. Offline banner appears at the top of the page.
6. Install button appears in Chrome address bar.

**Language packs:**
1. Click 🇪🇸 flag in header → word display switches to Spanish words.
2. Adaptive n-gram logic still works (bigrams from Spanish words get promoted on errors).
3. Refresh page → language persists (stored in localStorage).
4. Click 🇬🇧 → switches back to English.

**Code typing mode:**
1. Select "code" tab in mode bar.
2. A code snippet appears in the word display (smaller font, subtle background).
3. Type the snippet — special characters (braces, dots, semicolons) are required.
4. Test ends when snippet is complete.
5. Results screen shows WPM/accuracy normally.

**Smarter difficulty:**
1. Open DevTools console.
2. Import wordSelector: `const ws = await import('/src/lib/wordSelector.ts')`
3. Check that words with cross-row bigrams like "br", "vy", "fm" score higher than before.
4. The gameplay effect is subtle — harder words appear more in difficulty tiers 3 and 4.
