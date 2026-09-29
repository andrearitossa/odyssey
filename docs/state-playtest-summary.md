# Local structured-story implementation and playtest

2026-09-29. **Implemented locally; not ready for release.** One narrator call now produces a scene, explicit choices and proposed state changes. Code validates those changes and atomically saves the accepted turn and state. There is no second critic or repair call. The local migration is applied; nothing was deployed.

The clearest improvement is grounding: Farewell refused invented gold coins twice and Kreutzer refused an invented watch. The main regression is availability: invalid proposals and provider failures regularly return HTTP 502. Keeping the old scene intact prevents corruption, but repeated retries break immersion. Passing automated checks does not establish a good live experience.

## Method and scope

GPT-6 Luna playtest tasks used the real mobile web UI at 390×844, localhost:8081 and the real backend at localhost:8787. Each had a hard deadline of at most 15 minutes. Scripts targeted eight actions, mixing offered choices, natural dialogue and invented-object probes, followed by reload and restart. Responses were not mocked. A local-only IP header isolated test quotas.

The initial Family Guy worker hit an agent rate limit; an existing Luna tester took over that story in a fresh browser session because of the agent thread cap. Thus these are four story assessments, not four simultaneously running independent reviewers. They are small qualitative samples, not statistically reliable scores.

Initial runs exposed invalid JSON. Provider JSON mode was enabled before the final runs, then app code stayed fixed throughout them. Earlier attempts and a browser-driver selector failure are excluded from final-run counts. Kreutzer has two final-version runs; both must be counted. Failed requests show the previous saved scene and are not counted as new story material.

## Ratings and reliability

Ratings are each out of five, assigned by the Luna testers. “Coolness” means memorable, distinctive moments. These subjective scores describe observed writing; reliability must be assessed alongside them.

| Story | Quality | Engagement | Coolness | HTTP 200 / attempts | Coverage |
| --- | ---: | ---: | ---: | ---: | --- |
| Titanic | 3 | 4 | 4 | 7 / 10 | Opening + five actions; probes not reached |
| A Farewell to Arms | 4 | 4 | 4 | 9 / 12 | All eight actions; restart opening failed |
| Family Guy | 4* | 3* | 4* | 2 / 4 | Openings only; first action blocked |
| The Kreutzer Sonata | 3 | 4 | 3 | 15 / 20 | Two runs; second completed all eight actions |

*Family Guy ratings are provisional and describe opening material only.* Counts include opening, retry and restart requests on the final version. Across all five runs, **13 of 46 requests failed (28%)**. This is a small local sample, not an estimate of production reliability. Reload preserved sessions and messages in every completed check. Restart created a fresh session in every check, but Farewell's new opening failed.

Median request latency (including failures): Titanic 9.2s, Farewell 6.65s, Family Guy 11.84s; Kreutzer first run 16.94s and second run 7.89s. The slowest attempts approached 26s. Individual reports sometimes give successful-turn latency instead, so their latency populations differ.

## Findings from reading the interactions

- **Titanic:** Giving up a boat seat has a lasting consequence and the flooded corridors create pressure. But the narrator automatically scoops up a child, and a side search displaces the original sibling goal. A repeated failure on carrying the children prevents the object probes. Atmospheric writing does not compensate for the blocked action.
- **Farewell:** The wounded friend's fear of “all this being for nothing” and his wish to be left somewhere clean give the dialogue emotional weight. Invented coins remain absent on reuse. However, the model invents a reason for their absence (the retreat stripped the kit), calls the player a man, and leaves the column stalled through several turns. Grounding is improved, not solved.
- **Family Guy:** Peter trading a time machine for a hot dog is a promising absurd hook. Both attempts at the first action fail, so sustained humor, escalating jokes, agency and continuity cannot be judged. Opening-only ratings should not be compared directly with an eight-action story.
- **Kreutzer:** The confession remains psychological and contradictory testimony can remain a character claim. The invented watch is refused. The letter's meaning and chronology are still supplied freely by the narrator; structural validation cannot establish literary fidelity or prove prose consistency.

## What to fix next

1. Reduce failed turns before adding story features. Record concise validation categories and provider timeout/error categories, then reproduce concrete rejected proposals. In these runs, backend logs included “Person is not present” and “Invalid list”; JSON mode alone cannot enforce the whole schema.
2. Review multi-person movement: the current ordered move validator checks presence against the player's current position. Moving the player first can make a following companion's move fail. Validate a shared departure against the pre-turn location without permitting absent characters to teleport. This is a code-level diagnosis, not proof that every observed rejection had this cause.
3. Make failed-premise prose brief and factual. An absent object needs no invented ownership or loss backstory. Preserve character agency and advance the main objective instead of adding side searches or repeated stationary dialogue.
4. Repeat the interrupted probes after reliability is fixed. Do not claim Titanic or Family Guy inventory checks passed; they were never reached.

## Implementation checks

- Backend: 19 tests pass, including state rules, one-call persistence, retry/replay, rollback and stale-writer protection.
- Frontend: six targeted browser regressions passed for structured choices, resume/restart and retries; backend build and frontend typecheck pass.
- Structured output is buffered until validated. Rejected turns preserve saved state. Existing narrated sessions stay on the legacy path until restart.
- Important limits: checks cover declared changes, not all prose semantics; bounded state has no automatic compaction; no automatic repair inference is made.

Implementation details: [story-agents-architecture.md](story-agents-architecture.md). Individual reports: [Titanic](state-playtest-titanic.md), [Farewell](state-playtest-farewell.md), [Family Guy](state-playtest-family-guy.md), [Kreutzer](state-playtest-kreutzer.md).
