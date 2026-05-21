# Adapta-Type — Architecture

## Overview

Adapta-Type is a browser-based typing practice app. All typing logic runs entirely client-side for zero latency; the backend only receives a summary payload at the end of each test.

```
┌──────────────────────────────────────────────────┐
│                   Browser (React)                │
│                                                  │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │ TypingEngine │───▶│  N-gram Tracker      │   │
│  │  (hook)      │    │  ngramTracker.ts     │   │
│  └──────┬───────┘    └──────────────────────┘   │
│         │                       │               │
│         ▼                       ▼               │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │ WordDisplay  │    │  Word Selector       │   │
│  │ (component)  │    │  wordSelector.ts     │   │
│  └──────────────┘    └──────────────────────┘   │
│         │                                       │
│         ▼  (on test complete)                   │
│  ┌──────────────┐                               │
│  │  ResultsScreen│                              │
│  │  + WpmGraph   │                              │
│  └──────┬───────┘                               │
└─────────│────────────────────────────────────────┘
          │  POST /sessions  (JSON, one request per test)
          ▼
┌─────────────────────┐
│  FastAPI Backend    │
│                     │
│  - Pydantic valid.  │
│  - Rate limiting    │
│    (10 req/min/IP)  │
│  - Sentry errors    │
└──────────┬──────────┘
           │  service role key (bypasses RLS)
           ▼
┌─────────────────────┐
│  Supabase           │
│  PostgreSQL         │
│                     │
│  sessions table     │
│  RLS enabled        │
│  (no direct client  │
│   access)           │
└─────────────────────┘
```

---

## Data Flow

### During a Test (all client-side)

1. **Line generation** — `generateLine(ngrams, count=14)` in `wordSelector.ts` picks words from a 5 000-word bank. On the first line, all words are random. After that, ~70% of words are scored against the n-gram mistake map.
2. **Keypress handling** — `useTypingEngine` processes each key. Correct chars advance the cursor. Incorrect chars call `recordMistake(ngrams, expectedWord, charIndex)` which extracts bigrams/trigrams from the surrounding context and increments their count.
3. **Line advance** — when the user presses Space on the last word of a line, the next line is pre-generated and the display scrolls.
4. **Stats ticker** — a `setInterval` runs every second, sampling current WPM/rawWPM/errors into `wpmHistory`.

### After a Test

5. **Results** — `statsCalculator.ts` computes final WPM, raw WPM, and accuracy.
6. **Submission** — one `POST /sessions` to the FastAPI backend with the full session payload.
7. **Storage** — backend validates with Pydantic, inserts into Supabase using the service role key (bypasses RLS).

---

## N-gram Algorithm

When the user types a wrong character at position `i` in a word:

```
expected word:  "through"
typed char at i=2: 'r' (expected 'r') — but say user typed 'e' at i=2

context = expected.slice(max(0, i-1), i+3)  → "hro"  (1 before, 3 after)
bigrams:  "hr", "ro"
trigrams: "hro"
Each ngram count += 1 in the mistake map
```

On next line generation, words like "through", "throw", "thread" score higher because they contain "hr"/"ro" etc.

---

## Security Model

| Layer | Mechanism |
|---|---|
| Frontend keys | Only Supabase **anon key** — safe to expose; RLS blocks all direct table reads/writes |
| Backend | `SUPABASE_SERVICE_ROLE_KEY` — env var only, never sent to browser |
| Database | RLS enabled, **zero policies** = zero direct client access |
| Rate limiting | `slowapi` 10 req/min per IP on `POST /sessions` |
| Input validation | Pydantic with field-level constraints (ranges, max lengths) |
| CORS | `ALLOWED_ORIGIN` env var — locked to production frontend domain |
| Error reporting | Sentry (JS + Python) — no keystrokes logged server-side |

---

## Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Fast DX, strong typing |
| Styling | Tailwind CSS v4 | Utility-first, no runtime |
| Charts | Recharts | Composable, React-native |
| Backend | Python + FastAPI | Clean async API, Pydantic |
| Database | Supabase (PostgreSQL) | Managed, RLS, free tier |
| Rate limiting | slowapi + limits | Drop-in for FastAPI |
| Error tracking | Sentry | Both JS and Python SDKs |
| Deployment | Vercel (FE) + Railway (BE) | Free tiers, easy CI/CD |
