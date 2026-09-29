# Family Guy structured-state playtest

**Partial result: sustained interaction could not be assessed.** The fresh real-browser run opened the story successfully, then the first action and its retry both returned HTTP 502. The runner treated these as failures and stopped before the remaining seven planned actions. Its playful cutaway, lightsaber, spare fuel-cell, and practical-plan probes were not reached. The failed responses showed the previous opening again and did not add saved turns.

The opening sets a clear comic chase: a borrowed time machine is missing from the garage before noon, Peter appears in a giant chicken costume with a metallic object, and says he traded it to Mort for a hot dog. A parade blocks Spooner Street and the machine is beeping across town. The choices give distinct routes—press Peter, rush to Mort’s pharmacy, or recruit Stewie—with fitting costs. On restart, a new session opened with Peter holding a lawn gnome, Brian complaining about the noon deadline, and the clock at 11:05. These are strong, world-specific comic hooks, though two openings cannot establish how well the story follows player actions.

Provisional ratings for the opening material only:

- **Quality: 4/5.** The setup is concise and readable, with a clear objective and countdown. Multi-turn continuity is untested.
- **Engagement: 3/5.** The missing machine creates urgency and the choices suggest useful routes, but 502s blocked the first choice and any payoff or sustained agency.
- **Coolness: 4/5.** Peter’s chicken costume and hot-dog trade make a sharp cutaway-style image; the restart’s lawn gnome and Brian’s complaint add another recognizable gag.

There were four interaction attempts: median latency **11.8 s**, maximum **26.0 s**; two returned 200 and two returned 502. Successful openings were saved as `story-v1`. Reload preserved the same session and messages and restored Peter’s choices. Restart returned 200, created a new session, and saved a fresh opening. No browser page errors were recorded.

Evidence: [`family-test.json`](/tmp/odyssey-state-playtest/family-test.json). The earlier file was preserved at [`family-driver-error.json`](/tmp/odyssey-state-playtest/family-driver-error.json).
