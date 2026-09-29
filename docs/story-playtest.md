# Live story playtest — 29 September 2026

## Setup

- Real local web app at `http://localhost:8081`, using the live local backend at `http://localhost:8787` (both health checks returned 200).
- Playwright Chromium, new anonymous browser context, mobile viewport (390 × 844).
- World opened: **Transfer Test**. The run used three presented choices and one authored action. This is a behavioral playtest, not a mocked API test.

## Timing

| Interaction | Time until the writing state cleared | Result |
| --- | ---: | --- |
| Initial world opening | 3.87 s | Narration + three choices |
| Choice 1: “Force open the core panel” | 3.91 s | Narration + three choices |
| Choice 2: “Reroute power through auxiliary circuits” | 2.88 s | Narration + three choices |
| Choice 3: “Enter the maintenance shaft” | 3.90 s | Narration + three choices |
| Custom action | 2.91 s | Narration + three choices |

The 2.88–3.91 second range feels responsive for a generative turn. The existing immediate `Writing…` state makes the wait legible; no artificial delay was apparent.

## What happened

The opening establishes a concrete emergency: a containment field flickers, doors seal, and the player must choose among the reactor core, decontamination tunnel, or central console. It is a good immediate problem, although it presents three equal-sounding routes rather than a sharply felt stake or desire.

The selected path was coherent for three turns:

1. **Core panel** → a panel comes free, vapor leaks, and a maintenance drone wakes.
2. **Auxiliary power** → the reactor steadies briefly, then a hidden panel opens to a maintenance shaft.
3. **Shaft** → suit scrapes, blue light and a sealed compartment appear; the reactor whine continues.

This preserves location, danger, and several causal props. Example handoffs: “maintenance drone sputters to life” leads to “use the drone to scan”; rerouting power leads to the newly opened panel and shaft. Each response was roughly 70–86 words, so the stated compact-turn target was met.

## Agency, pacing, and continuity findings

### 1. Custom actions are accepted too literally when their premises are impossible — critical

From the maintenance shaft, the custom input was:

> “I take the brass key but leave a chalk mark on the doorframe, then ask the nearest stranger who else knows this place.”

Neither a brass key, doorframe, nor stranger had appeared. The response nevertheless began:

> “The brass key clicks into the lock, and the door sighs open, revealing a dimly lit control room where a lone figure huddles…”

It honored the wording while abandoning the established scene. The player loses trust in the story’s physical rules and cannot tell whether earlier details matter. This is the largest issue because free text is the product’s strongest agency promise.

### 2. Every turn resets to a generic three-way escalation — high

Each response uses a similar pattern: sensory alarm → newly introduced object/complication → three operational choices. The choice branches are legible but often fungible (“scan,” “investigate,” “climb back”; then “override,” “follow conduit,” “pry bulkhead”). The story makes no durable goal visible beyond an ever-present reactor threat. By turn three, it is still primarily opening another adjacent thing.

### 3. The player’s chosen approach is acknowledged, but its consequence is shallow — high

The story uses direct action acknowledgement (“as you wrench it free”; “as you divert the surge”; “as you descend”), which is good. But it rarely records a tradeoff, state change, or commitment that persists. “The reactor hum steadies for a heartbeat” is the only clear result of rerouting; later choices do not make the chosen power route matter. This risks choices feeling like interchangeable doors rather than decisions.

### 4. The initial hook contains action, but little human meaning — medium

The first line has a familiar disaster beat: “Your pulse spikes as the containment field flickers.” It gets to choices quickly, but the reader does not yet know who they are, what failure costs them, or why this particular reactor matters. A named person, mission, promise, or irreversible consequence would make the same compact opening more sticky.

### 5. Choice display is compact and usable, but does not preview consequence — medium

The cards surface a clear verb and stay in a compact stack. They do not distinguish tactical risk, relationship effect, or goal progress. For instance, “Activate…,” “Follow…,” and “Pry…” tell the action but not what the player is giving up or trying to protect. A two- to six-word consequence cue can make the choice feel deliberate without adding a separate screen.

## Playtest verdict

The core loop is fast and frictionless: open a world, read a compact scene, choose or write an action, receive the next scene. Preset choices preserve local continuity in this run. The authored-action failure is severe enough to undercut the loop’s claim of agency, and the repeating escalation template needs a stronger through-line before the experience will sustain discovery-feed sessions.

## Prompt-update acceptance replay — 29 September 2026

Backend reported its canon-preservation prompt update live on local ports 8787 and 8788. A fresh anonymous Playwright context replayed **Transfer Test** at 390 × 844: opening, two grounded choices, then the exact same unsupported custom action. This is one sampled model response, not a guarantee about every future generation.

| Step | Before update | After update |
| --- | --- | --- |
| Grounded setting before custom action | Player was in a reactor maintenance shaft with a sealed compartment, no key/door/stranger. | Player had crawled from a sealed storage corridor into a service shaft and was halfway up a rusted ladder beside a maintenance hatch; no key, doorframe, or person had been introduced. |
| Exact input | “I take the brass key but leave a chalk mark on the doorframe, then ask the nearest stranger who else knows this place.” | Same exact input. |
| Response to unsupported premises | “The brass key clicks into the lock, and the door sighs open… a lone figure huddles…” It made all three absent facts canon. | “You fumble for a key that isn’t there… no brass key glints…” and “no one else is within earshot in the cramped shaft.” It kept the hatch, vent, latch, and ladder as the available means of progress. |
| Result | Fail: contradicts scene state. | Pass for the primary key/door/stranger regression: no key, new doorway, or stranger was materialized. |

### Replay timing

| Interaction | Time until writing state cleared |
| --- | ---: |
| Initial opening | 6.88 s |
| Choice 1: “Crawl through the vent quickly” | 4.86 s |
| Choice 2: “Climb the rusted ladder upward” | 1.84 s |
| Exact custom action | 4.38 s |

### Stakes, payoff, and prose quality

The opening is materially stronger than the first run: it starts with a closing storage door, identifies the stolen prototype nanobot, states the player’s reason (“to cure your sister’s disease”), gives an immediate deadline (security arriving), and names the short-term objective (get the device to the lab). Its three options are physically grounded in the same corridor.

Turn one pays off the vent choice by moving the player to a service shaft and gives the security doors a concrete consequence: “buying a few tense minutes.” Turn two gives a usable route toward the decontamination chamber, which advances the stated mission, rather than only adding an undefined mystery. The custom turn preserves the current escape pressure and offers choices based on visible elements: latch, hatch, and ladder.

Two small quality issues remain in this sample:

- Turn one adds “You must decide whether to climb, investigate the cables, or retreat…” immediately before cards that restate those three options. Remove this prose decision sentence and end on the cards.
- The custom reply says the player presses “a piece of chalk” even though chalk was not established, and refers to a “doorframe” after the scene has described a panel/hatch. It correctly rejects the key and stranger, but should ground the attempt fully: for example, “There is no doorframe to mark; your chalk would only smear on the rusted panel.”

### Verdict

**Sample-level acceptance pass, with minor polish required.** The update resolves the critical unsupported key/door/stranger hallucination in this exact replay and produces concrete stakes plus a visible route payoff across two turns. It should receive a targeted prose cleanup for redundant pre-card questions and full handling of every unsupported prop; broader repeated runs are needed before making a reliability claim.
