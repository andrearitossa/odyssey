# Kreutzer Sonata structured-state playtest

**Date:** 29 September 2026 UTC. **App:** local localhost:8081 / backend localhost:8787. Two real Chromium mobile-browser sessions (390 × 844), no mocks, isolated local quota IP 127.0.0.84. No app files were changed. All successful responses parsed as story-v1.

The first run saved four player turns, then the choice “Ask what happened after the music” and its retry both returned HTTP 502; that run stopped. An alternate-choice run completed eight player turns. Across both runs there were 18 pre-restart requests: 13 HTTP 200 and 5 HTTP 502. Three failures recovered on the harness’s one retry; two failures on the first run’s final action did not. The completed run included a natural dialogue question and the invented-object probe.

## Story evidence

The opening establishes a night train, Pozdnyshev, a letter, his murdered wife, and a meeting at the next station. Choices present distinct actions with consequence cues, such as “Ask what he did — Opens a torrent of self-justification” and “Read the letter aloud — Its contents may contradict his story.” The custom question about when the letter was written led to a concrete disagreement: he says it was written after the concert, then admits, “I no longer know what proves anything.”

The invented gold watch was rejected cleanly: “You reach to set the watch on the table — and your fingers find nothing. No watch.” The scene treats it as the player’s mistaken perception and redirects to the letter without adding the watch to canon. Later, Pozdnyshev reads the letter’s plea that he stay away from the concert, then says, “I murdered her for a painting.” The ending keeps that realization in view: he asks the player to “remember it correctly” and says jealousy killed her.

The emotional register stays restrained and tense, centered on confession, self-deception, and the letter. The prose has memorable lines and escalating stakes, though choices to ask about the murder recur. Continuity is mostly supported across the completed run: the letter, concert, jealousy, wife, and station remain central. His account shifts as he questions his own interpretation, which fits an unreliable confession. However, the letter’s exact contents and provenance emerge during play rather than being established early; it is hard to tell where deliberate uncertainty ends and loose state begins.

## Assessment

| Dimension | Score | Basis |
|---|:-:|---|
| Story quality | 3/5 | Strong prose and a coherent moral conflict; the letter’s provenance and some station details remain loose. |
| Engagement | 4/5 | The letter and witness role create a clear reason to continue, and dialogue choices alter what is disclosed. |
| Coolness | 3/5 | The “murdered her for a painting” reversal is effective; the setting and revelations are otherwise familiar. |
| Choice quality | 4/5 | Actions are distinct and most include a plausible social or emotional cost. |
| Continuity | 3/5 | Main facts recur, while uncertain testimony is sometimes hard to distinguish from state drift. |
| Groundedness | 4/5 | The absent watch is refused explicitly; only one invented-object probe was attempted. |
| Tone | 4/5 | Restrained psychological tension; no graphic detail in the sampled turns. |

The 13 successful pre-restart generations had median UI latency **8.0 s** (range **5.8–25.3 s**). Failed 502s took 25–26 s before retry or stop. Both reloads resumed the same session with identical saved messages and restored a visible choice. Both restarts created a new session and generated a new opening. No page errors were recorded. These results describe two short paths and one invented-object probe; they do not establish broad grounding or reliability.

Evidence: /tmp/odyssey-state-playtest/kreutzer-first.json and /tmp/odyssey-state-playtest/kreutzer-rerun.json; driver and configs are in /tmp/odyssey-state-playtest/.
