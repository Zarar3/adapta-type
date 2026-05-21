# Adapta-Type — Roadmap

## ✅ Phase 0 — Foundation (current)
- [x] Repo structure and tooling
- [x] Supabase schema + RLS
- [x] FastAPI backend (rate limiting, Sentry, Pydantic validation)
- [x] Core typing engine (timed mode)
- [x] N-gram mistake tracker
- [x] Adaptive word generation (70% struggle words per line)
- [x] WPM / raw WPM / accuracy stats
- [x] Per-second WPM graph with hover tooltip (Recharts)
- [x] Sentry integration (frontend + backend)

---

## Phase 1 — Polish
- [ ] Smooth line-scroll animation (CSS transition)
- [ ] Caret animation (blink, smooth movement)
- [ ] Sound effects toggle (click, error)
- [ ] Keyboard shortcut: `Tab` + `Enter` to restart test
- [ ] Dark/light theme toggle (Tailwind dark mode)
- [ ] Mobile layout (virtual keyboard support)
- [ ] Favicon and Open Graph meta tags

---

## Phase 2 — More Modes
- [ ] **Word count mode** — type N words, no timer
- [ ] **Quote mode** — real quotes from a curated list
- [ ] **Custom text mode** — paste your own text to practice
- [ ] Configurable time options beyond 15/30/60/120s

---

## Phase 3 — Smarter Adaptive Algorithm
- [ ] **Decay over time** — reduce n-gram weights for mistakes made many lines ago
- [ ] **Per-session persistence** — keep mistake map across multiple tests in one session (localStorage)
- [ ] **Bigram heatmap** — visualize which character combinations the user struggles with
- [ ] **Contextual difficulty** — avoid always showing the same practice words; rotate from a wider pool

---

## Phase 4 — Analytics
- [ ] **Aggregate leaderboard** — top WPMs (no login required, just a nickname)
- [ ] **Global n-gram heatmap** — show which sequences all users struggle with most
- [ ] **Personal history** — localStorage-based session history graph
- [ ] **Export results** — download as PNG or CSV

---

## Phase 5 — Social / Competitive
- [ ] **Multiplayer race** — real-time typing race via WebSockets
- [ ] **Share result** — shareable card image (like Wordle sharing)
- [ ] **Challenge mode** — given a specific n-gram, generate a focused practice set

---

## Phase 6 — Advanced
- [ ] **ML-based difficulty scoring** — use frequency and co-occurrence data to weight words more intelligently
- [ ] **Language packs** — French, Spanish, German word banks
- [ ] **Code typing mode** — practice typing common programming patterns
- [ ] **PWA** — installable as a progressive web app with offline support

---

## Known Limitations (current)
- Word list is static (5 000 words); no server-side word generation
- N-gram map resets on page refresh (no persistence yet)
- No mobile keyboard support
- Backend stores sessions but no read endpoint yet (data is for future analytics)
