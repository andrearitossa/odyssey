# Ranked experience proposals

These proposals retain the agreed loop: **world → scene → choice or custom action → next scene**. They aim for one compact, visually unified continue/discover feed rather than adding a planning layer or a new creation flow.

## P0 — Make custom actions canon-safe before generating the next scene

**Problem observed:** A player introduced a brass key, door, and stranger from inside an established reactor shaft; the narrator made all three real. This breaks spatial continuity and makes world facts unreliable.

**Concrete edit:** Add a short narrator instruction and structured turn context:

> Treat established scene facts as canon. First honor the player’s *intent*. Do not assert an object, character, exit, or prior event that has not appeared or been plausibly discovered. If an action relies on a missing premise, let the player attempt/search/ask for it in the current scene, state the limitation plainly in-world, and advance a consequence that fits the actual location.

Pass a five-item compact state block on every turn: current location, immediate threat, present NPCs, accessible objects/exits, and unresolved goal/clock. Ask the model to output a one-line `state_delta` internally (not necessarily in the UI) so the server can retain the facts needed next turn.

**Acceptance check:** From the shaft, the brass-key test says there is no door/key/stranger there and lets the player inspect the compartment, mark the shaft, or call on comms. It must not materialize any of those items without a discovery beat.

## P1 — Put a personal stake and a durable objective in the opening

**Problem observed:** “Containment field flickers” starts quickly but could describe any lab scene; three turns later the goal is still only generic emergency escalation.

**Concrete edit:** Make every opening follow this 45–75 word shape:

1. Specific disruption in sentence one.
2. Named relationship, promise, or irreversible cost in sentence two.
3. A reachable short-term objective and countdown/constraint in sentence three.
4. Two or three actions that pursue meaningfully different approaches.

Example for this world: “The containment field stutters just as Mara’s last transmission reaches your suit: *don’t let them seal me in.* You have six minutes before the core locks down, and the only route to her signal runs past a live reactor. Force the service panel, race the decontamination tunnel, or override the central console?”

**Acceptance check:** A first-time reader can answer “what do I want, why now, and what could I lose?” after the first scene.

## P1 — Make each choice change a visible state, then name that change

**Problem observed:** Preset actions were locally acknowledged, but their tradeoffs did not persist; new props mostly replaced the prior decision.

**Concrete edit:** Write choice triples across distinct consequence dimensions. At least two options must differ on a durable dimension:

| Choice shape | Immediate gain | Lasting cost/state |
| --- | --- | --- |
| Fast/forceful | advances location | raises threat or damage |
| Careful/investigative | reveals reliable information | consumes time |
| Social/creative | gains help or access | creates a promise, debt, or suspicion |

Open the next scene with a causal receipt of 8–18 words: “Because you rerouted power, the lockdown clock gained ninety seconds—but the drone is now hostile.” Only then introduce the next pressure.

**Acceptance check:** After any two selected turns, a reader can name at least two facts that would be different had they chosen another card.

### Narrator quality rule for P1

Require every scene to do one concrete piece of story work: reveal a usable fact, alter an available resource/access route, advance a clock, change a relationship, or pay off an earlier setup. Ban placeholder suspense such as “hinting at secrets” or “promising danger or revelation” unless the same turn identifies what is seen/heard/found and why it matters. End on the cards themselves; do not append a question that merely restates their verbs.

**Acceptance check:** A turn cannot pass review if its only novelty is an unspecified glow, sound, spark, secret, danger, or revelation. A reader can point to one newly actionable fact in every turn.

## P2 — Give compact choice cards a consequence cue

**Problem observed:** Verb-first cards are clear but not strategically distinguishable.

**Concrete edit:** Keep the existing one-line action and arrow; add a muted 2–6 word cue beneath it, generated with the choice:

- “Force the core panel” — *fast; triggers an alarm*
- “Take the decon tunnel” — *safer; loses the signal*
- “Override the console” — *learns the truth; costs time*

This preserves the current compact interaction while turning “three verbs” into a decision. Do not add a separate explanation view.

**Acceptance check:** In a three-card set, all cards have distinct verbs and distinct anticipated consequence cues.

## P2 — Turn the feed into a single continuation-first discovery surface

**Problem observed:** The present Explore screen already contains both active and new worlds, but “Continue a story or step into a new world” leaves the resumed narrative’s hook and next decision hidden.

**Concrete edit:** Keep one feed and a single scroll. Pin one compact **Continue** card at the top when a session exists: title, last causal receipt/scene fragment, current objective, and a “Continue” action. Below it, show **Discover** as the same card system for new worlds, with one-sentence premise and stakes rather than a separate mode. Do not create a tab, modal, or onboarding step.

**Acceptance check:** A returning player can resume in one tap and understands the unfinished pressure before tapping; a new player can enter a world without authentication or a flow switch.

## P3 — Measure sustainable continuation, not only immediate interaction

**Concrete edit:** Record privacy-safe aggregated events: world card viewed, start, first scene rendered, choice shown/selected, custom action submitted, response rendered, session resumed, and story abandoned before a response. Segment by opening version, turn number, choice vs. custom action, and latency bucket. Review the curve weekly for first-turn completion, turns 2–5 completion, custom-action survival, and 24-hour resume.

**Acceptance check:** A release decision can say whether a change improved continued reading and return, and whether it introduced a continuity-related custom-action drop-off.
