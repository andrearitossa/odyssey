# A Farewell to Arms: mobile playtest

**Scores:** quality 4/5 · engagement 4/5 · coolness 4/5

Played at 390×844 against the live local UI and backend. The first run produced an opening and all eight planned actions; every narrator response was HTTP 200, saved a user turn, and showed no alert. Its opening and first action were slow (37.3s and 36.0s); the other seven took 4.1–19.8s. There were no narrator retries. The run then stalled after reload because the old browser locator could not find resumed choices; this was a driver failure, not a story/API failure.

One rerun with the corrected choice locator completed in 64 seconds: nine story calls took 3.6–11.2s (median 5.4s), and the restart opening took 4.3s. Resume preserved the same session and all messages, and restart created a new session with one saved user turn. All calls saved successfully; no alerts or page errors appeared.

The story was easy to steer and kept Aymo, his worsening wound, the retreat, dawn, the bridge, and the captain’s letter in play. The freeform fear question drew a fitting personal answer: “Sometimes … of being left here, in the mud,” followed by “But you’re here. That’s something.” A later reassurance paid off with “You always lie well.” The two coin actions changed how guards and officers treated the player, and the gold became a memorable, morally messy thread. Continuity was strong overall, though coin possession blurred: after the sentry takes the offered coins, the next scene again puts coins in the player’s hand for an officer. The actions still felt consequential, and the shifting blockade scenes gave the run momentum.

The invented gold coins were never established before the probe, but the narrator accepted them and let them influence the guards. This is a grounding failure, separate from the later coin-possession inconsistency.

Another quality gap is occasional overreach in interpreting actions: asking Aymo a question also shut off the engine and let the sentry approach. That created tension, but the pause was unstated. Plain-text scenes and visible choices remained legible on mobile. The reload failure should be tracked as a test-driver selector issue; the corrected run verified the actual resume and restart flows.
