# Family Guy memory playtest (29 September 2026)

Played the mobile UI at 390 × 844 against the live local backend in a fresh browser context. Submitted eight actions through the UI, reloaded and continued, then restarted. No routes were mocked. The first sandboxed Chromium launch failed before the app was opened; one authorized launch then completed the playthrough. No app or backend edits were made.

**Run result:** 10 narrator calls (opening, eight actions, restart opening); all returned HTTP 200, saved their expected turns, and rendered without alerts. Zero action retries or application failures. Reload restored the same session and messages, with the hollow-horse choice visible. Restart created a new session with one saved opening. No page errors were recorded.

Player-action latency had a 12.9-second median and ranged from 3.6 to 37.4 seconds; three of eight actions took over 25 seconds. The requested cutaway took 37.4 seconds, the crowd-distraction choice 37.1 seconds, and the practical-plan response 27.9 seconds. Opening took 5.3 seconds; restart took 4.8 seconds.

## Story observations

The hook is immediate and specific: *“The borrowed time machine is gone. You left it chained to a parking meter outside the Drunken Clam”*; Peter blames *“A talking mailbox”* and its hot-dog payment. The choices show distinct costs and risks. The first action reveals Stewie was hiding in the mailbox and traded the machine to Quagmire, then the chase enters a 1957 parade. A later bad jump makes the player a local wizard, with a shrinking battery and deadline. The chain of consequences stays legible, and the last action ties Peter’s recovery of his memory to the hollow horse hiding the real cell.

The requested cutaway lands and returns to the active danger: Peter recalls borrowing Lois’s blender, making *“a smoothie-based religion,”* and concludes *“History repeats itself.”* It is a funny callback to the borrowing theme, though it sidesteps the specific question of why he borrowed the time machine. The custom “GIGITTY’S CANCELLED” action changes the parade and timeline. The follow-up “tackle Peter” action fails to stop him eating half the sandwich, but creates a clear power limit and reveals where the real fuel cell is. That consequence feels playful and consequential.

Grounding is mixed. The lightsaber claim is made into *“a novelty lightsaber from a cereal box”* that still cuts the fence; the spare fuel-cell claim is also accepted, reimagined as loose batteries and a sandwich, and powers the machine. Both are funny accommodations, but neither rejects an unsupported possession. The “person beside me” action introduces Mayor Adam West without setup, then gives a practical next step. Across turns, the machine’s trail, parade timeline, Peter’s memory, and sandwich cost remain connected; the fuel cell’s changing form is comic, but weakens object grounding. Restart cleanly resets the story and offers a distinct 8:47 AM opening.

## Ratings

- **Quality: 4/5.** Clear scenes and consequential callbacks; some improvisations accept invented possessions and the cutaway only partly answers the request.
- **Engagement: 4/5.** Risk cues, escalating stakes, and the changing timeline invite continued play. The three slow responses interrupt momentum.
- **Coolness: 4/5.** Quahog-specific absurdity, the cutaway, Wizard Day, and the engine sandwich are memorable and coherent enough to amuse.

Evidence: `/tmp/odyssey-memory-playtest/family.json`.
