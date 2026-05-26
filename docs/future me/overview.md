# Adapta-Type — Project Overview

## What It Is

Adapta-Type is a MonkeyType-style typing trainer with an adaptive intelligence layer. Unlike MonkeyType (which is purely speed-focused), Adapta-Type watches what you struggle with as you type — specific letter combinations (n-grams) — and biases future words to force practice on exactly those patterns. It's a typing trainer that learns your weaknesses and refuses to let you ignore them.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| Testing | Vitest |
| Backend | FastAPI (Python) — session persistence only |
| Database | Supabase (Postgres) — raw session logs |
| Hosting | Vercel (frontend), inferred |

## High-Level Architecture

```
App.tsx
├── useTypingEngine (core game loop + n-gram tracking)
├── usePatternLibrary (persistent pattern wall state)
├── useSound (Web Audio API)
│
├── TypingArea (active test UI)
│   ├── WordDisplay (per-char colored rendering)
│   └── TimerBar (duration selector + progress)
│
├── ResultsScreen (post-test breakdown)
│   ├── StatsBar (wpm / raw / accuracy / duration)
│   └── WpmGraph (line chart of wpm over time)
│
└── PatternWall (full-screen pattern history view)
```

## The Core Idea

Every keypress is tracked as a bigram (2-char) and trigram (3-char) sequence. These are called **n-grams**. The system records:
- How many times you've typed each n-gram
- How many times you got it wrong
- How long it took you (inter-keystroke timing, accumulated across sessions)

When an n-gram crosses an error threshold, it gets **promoted** to the active focus set. The word generator then deliberately picks words containing that n-gram until you type it correctly 3 times in a row, at which point it **graduates**.

This creates a feedback loop: struggle with something → it appears more → you're forced to practice it → it graduates → next weakness surfaces.
