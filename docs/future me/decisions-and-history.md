# Design Decisions & History

Things that were tried, changed, or deliberately chosen in a non-obvious way. Future-you will want to know why things are the way they are.

---

## Why errors count even when backspaced

**Decision:** A wrong keypress increments `errors` on the bigram permanently, even if the user backspaces and retypes correctly.

**Reason:** The wrong finger motion already happened. If you always mistype `th` and then correct it, you still have a muscle memory problem for `th`. Forgiving backspaces would make the tracker blind to a huge class of real mistakes.

---

## Why trigrams are preferred over bigrams on promotion

**Decision:** `promoteNgrams` checks if the qualifying bigram's containing trigram also meets the threshold. If it does, the trigram is promoted instead.

**Reason:** A bigram like `th` appears in `the`, `this`, `with`, `that`, etc. If the real problem is specifically `the`, promoting `th` would flood all the other words too. Promoting the trigram is more surgical.

---

## Why slow patterns don't show in "focusing on" chips during the test

**Decision:** Timing-seeded patterns (`slowNgramKeys`) are excluded from the yellow "focusing on" chips shown above the words. They still bias word generation silently.

**Reason:** Showing "consistently slow" chips during a test was described as "very disorienting and looks terrible." The results screen is the right place for that insight. During the test you just want to type; the distractions made it worse.

---

## Why proactive same-finger seeding was removed

**Decision:** There was a feature that pre-seeded same-finger bigrams (e.g., `rf`, `un`) at test start. It was built and then explicitly removed.

**Reason:** User's words: "it really should be random." Proactively injecting patterns without any evidence the user struggles with them felt presumptuous. The test should start neutral and let actual behavior drive adaptation.

---

## Why the promotion gates were tightened back to 15%

**Decision (2026-08-04):** Promotion now requires `seen >= 4 AND errors >= 2 AND errors/seen >= 15%`, and at most 3 patterns hold chip slots at once.

**Reason:** User feedback — too many patterns lit up at once and it was overstimulating. The code had also drifted to `ERROR_MIN = 1`, so a single mistyped key spawned a chip immediately, and with no minimum sample count a bigram seen twice could qualify off two slips. `SEEN_MIN` stops the early-session flood, `ERROR_MIN = 2` stops one-off slips, and 15% means the pattern has to be missed consistently rather than occasionally.

**Supersedes:** the earlier "10% not higher" decision, which argued 15%/20% missed real struggles. That trade-off is accepted: a pattern missed occasionally now waits until it's missed consistently before it takes up a slot. The results screen still lists every pattern with `errors > 0`, so nothing is hidden from the user — it just doesn't grab attention mid-test.

---

## Why `ngramMistakes` threshold was changed to `errors > 0`

**Decision:** The results screen "still struggling" section originally used `errors >= 2 AND rate >= 10%`. Changed to just `errors > 0`.

**Reason:** The original threshold was the PROMOTION threshold — designed to decide when a pattern should enter active practice. But for DISPLAY in the results, even one mistake is worth showing the user. The old threshold caused "still struggling" to appear empty on most runs even when the user did make mistakes. The persistence mechanism (auto-graduation after 3 sessions × 1.5× improvement) handles cleanup instead.

---

## Why the struggling map and the slow map are separate

**Decision:** Two localStorage keys — `adapta-type-struggling` (error-based) and `adapta-type-flagged-slow` (timing-based) — rather than one unified "weak patterns" store.

**Reason:** They have different lifecycles. Slow patterns are permanent and show improvement status but never delete. Struggling patterns can be graduated via practice. Merging them would complicate the graduation logic and blur the distinction between "you're slow at this" vs "you make errors on this."

---

## Why the Pattern Wall and the results screen are separate views

**Decision:** There are two pattern surfaces — the Pattern Wall (full-screen historical view) and the results screen breakdown — with somewhat overlapping data.

**Reason:** The Pattern Wall is a long-term history view with detailed stats (best WPM per pattern, session count). The results screen breakdown is immediate feedback for the current run. They serve different mental modes: results = "what just happened", wall = "what am I working on overall."

---

## Why there's a `MIN_PRACTICE_WORDS = 5` filter on promotion

**Decision:** `hasSufficientCoverage(pattern)` checks that at least 5 words in the word list contain the pattern before it can be promoted.

**Reason:** Very rare bigrams (like `xz`) could theoretically be promoted but there aren't enough words to practice them effectively. Without this check, the word generator would just cycle the same word repeatedly, which is useless for learning.

---

## Backend is fire-and-forget

**Decision:** The session POST to the FastAPI backend uses `.catch(() => {})` and the result is never read.

**Reason:** The backend is for aggregate data logging / future analytics. Nothing in the frontend depends on it. A failed POST should never break the results screen.

---

## Why the 3-word window (not a full line like MonkeyType)

**Decision:** Only 3 words exist at a time. When a word is completed it immediately slides off and a new one is appended.

**Reason:** This allows the word generator to react immediately to new n-gram promotions. In a line-based system you'd have to wait until the line is done before new patterns influence the next line. With a sliding window, a newly promoted pattern can appear in the very next word.
