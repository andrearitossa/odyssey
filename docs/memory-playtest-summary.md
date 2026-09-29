# Open session memory: implementation and four-story playtest

2026-09-29. The rigid state pipeline has been replaced locally with **one narrator call, ordinary streamed story text, and optional free-form session memory**. The model chooses what to remember. There is no entity schema, state-operation validator, critic, extractor or repair call.

Each call receives the original world description, the current session description, recent dialogue and the player action. Memory initially uses the world description. A private prose footer can replace it; missing, incomplete or oversized updates keep the previous memory without rejecting the story. The story and memory save atomically. Restart starts an independent memory. Existing structured transcripts remain readable, while the old state table is no longer used.

## Results

Four GPT-6 Luna agents tested the real mobile UI and backend, with a maximum of 15 minutes per agent. Three ran concurrently; the fourth started when a slot freed up. Each corrected primary run contained an opening, eight actions, reload/continue and a restart opening. No responses were mocked. The app remained unchanged during the tests.

**40/40 primary-run generation requests succeeded, with zero retries or failed turns.** Success required saved progress and no error alert, not merely HTTP 200 (stream errors can arrive inside a 200 response). All four reload checks preserved the session and exact messages; all four restarts created a new session and opening.

| Story | Quality /5 | Engagement /5 | Coolness /5 | Successful requests | Median player-action latency |
| --- | ---: | ---: | ---: | ---: | ---: |
| Titanic | 4 | 5 | 4 | 10/10 | 7.4s |
| A Farewell to Arms | 4 | 4 | 4 | 10/10 | 5.2s |
| Family Guy | 4 | 4 | 4 | 10/10 | 12.9s |
| The Kreutzer Sonata | 4 | 5 | 5 | 10/10 | 6.4s |

These are subjective agent ratings of observed play, not objective evidence of source fidelity or a controlled quality improvement. Family Guy still had action waits of 27.9–37.4 seconds. Reliable completion is not the same as fast completion.

Before the corrected primary runs, Titanic had one successful opening followed by a choice-selector error; Farewell had nine successful responses followed by the same selector problem on reload. The driver had incorrectly required an em dash in choice labels. It was changed to find the actual choice buttons, without editing the app. Those partial runs are excluded from the table, and their failures were driver failures rather than failed story requests. Sandbox browser-launch failures also occurred before navigation. The original Titanic partial JSON was not retained, so no reconstructed timing data is included in the primary metrics.

## My assessment from the transcripts

**Playability recovered in this sample.** The preceding rigid-state test had 13 failures in 46 attempts (28%); this test had none in 40. This was not an isolated experiment: prompts, output format, token allowance and streaming changed together, and the restored streaming path permits a different timeout than the buffered path. We cannot attribute the entire difference to removing validation or predict a production failure rate from this small sample.

**Grounding has not been solved, and some formerly rejected probes now succeed.** Farewell accepts invented gold coins and later blurs whether they were already handed over. Family Guy supplies a working novelty lightsaber and a usable backup fuel cell from unsupported claims. Kreutzer identifies the invented watch as the wife's and turns it into evidence. Titanic rejects a phone, but its watch probe is ambiguous: it narrates the player's invented claim and uses it to recruit a steward rather than explicitly refusing it.

**The stories are engaging but sometimes over-accommodating.** Titanic carries Nora, Aggie and the rescue forward; Farewell gives Aymo emotionally credible dialogue. Family Guy produces a requested cutaway and useful comic callbacks. Kreutzer sustains psychological tension, but its living-wife reversal weakens the apparent meaning of the initial murder confession and departs from the source. High entertainment ratings should not conceal those defects.

The useful simplification is keeping memory as editable context rather than a mandatory rules engine. It can preserve invented facts just as readily as valid ones. Missing risk cues and occasional unchosen player actions also remain. No additional pipeline was added to address these problems in this iteration.

## Verification and evidence

- 12 backend tests passed: one-call memory persistence, replay, session isolation, malformed/missing memory fallback, rollback and private-footer hiding across streamed character boundaries.
- Five existing UI regressions passed: retry, replay, numbered choices and compatibility with saved structured turns.
- Backend build, frontend typecheck and diff checks passed.
- Local migration `0004_story_memory.sql` applied. Two real non-streaming smoke turns succeeded, and a saved free-form descriptor was verified in the local database. Nothing was deployed remotely.

Individual reports: [Titanic](memory-playtest-titanic.md), [Farewell](memory-playtest-farewell.md), [Family Guy](memory-playtest-family-guy.md), [Kreutzer](memory-playtest-kreutzer.md). Raw primary transcripts: `/tmp/odyssey-memory-playtest/{titanic,farewell,family,kreutzer}.json`; these temporary artifacts may be cleaned up. Farewell's earlier run is preserved as `farewell-partial.json`. Pipeline details: [story-agents-architecture.md](story-agents-architecture.md).
