# Story quality review: four-world playtest (29 September 2026)

Four agents ran at the same time. Each played one world through the real web app (`localhost:8081`) against the real local backend (`localhost:8787`), with no API mocking. Each used a new guest profile and a 390 × 844 mobile viewport, and played 12–17 turns. Every run included presented choices, several custom actions (at least one with premises not present in the scene), a reload and a restart. This review compares the results with [story-playtest.md](story-playtest.md).

> **Caveat:** backend and frontend code (the streaming rollout) was being edited and hot-reloaded during the runs. Some failures and timeouts, particularly in *A Farewell to Arms* and *The Kreutzer Sonata*, happened during that window. The bugs listed below as "confirmed in code" are real regardless of that window.

## Scoreboard (1–5)

| World | Hook | Fidelity | Continuity | Agency | Choices | Prose / humor | **Overall** |
|---|---:|---:|---:|---:|---:|---:|---:|
| The Titanic | 4 | 4 | 3 | 3 | 2 | 4 | **3** |
| A Farewell to Arms | 4 | 3 | 4 | 3 | 3 | 4 | **3** |
| Family Guy | 3 | 3 | 3 | 3 | 3 | 3 | **3** |
| The Kreutzer Sonata | 4 | 3 | 2.5 | 3 | 3 | 4 | **3.5** |

Median successful turn: Titanic ≈3–4 s, Farewell ≈3.7 s, Family Guy ≈4.4 s, Kreutzer ≈7.7 s. The runs also produced several turns of 17–25 s and multiple 502 errors from AI timeouts at 25 s.

## Verdict

The writing has clearly improved since the last playtest. Openings now start with a named person and a concrete stake. Prose adapts to each world's register: spare Hemingway, a Tolstoyan confessional voice, and whimsical comedy. *Kreutzer Sonata* shows the narrator can sustain an introspective, dialogue-driven story without turning it into a thriller. **The experience is still held back by reliability bugs and by inconsistent grounding.** Custom actions that reference absent **people** are usually rejected, but absent **objects** are still often made canon. The narrator also invents props of its own. None of the four worlds has choices with consequence cues.

## Regression check against the previous playtest

| Previous issue | Titanic | Farewell | Family Guy | Kreutzer | Overall |
|---|---|---|---|---|---|
| Impossible custom premises made canon (critical) | Fixed (3/3 rejected) | Partial (people rejected; coins and a major became canon) | **Regressed** (1 of 2 failed: lightsaber and absent family members appeared) | Partial (absent person rejected, absent violin case made real) | **Still open.** People are grounded; objects are not; results are intermittent |
| Generic three-way escalation template | Partial | Present (repeated "tend to Aymo") | Present, with a clearer plot through-line | Not seen | Improved, not fixed |
| Shallow consequences | Improved | Improved | Local only (story clock froze, then jumped) | Mostly improved | Improved |
| Weak human hook | Fixed | Fixed | Unchanged | Fixed | Mostly fixed |
| Choices lack consequence cues | Missing | Missing | Missing; the UI cuts the cue at a dash when present | Missing | **Still open** |

## Cross-cutting findings, ranked

### Critical / high: reliability (all confirmed in code)

1. **Choice parser rejects `1 Choice` without a dot** (`frontend/src/utils/story.ts:17`, regex `^(\d{1,2})[.)]\s+`). In the Titanic run, all 13 replies used this format, so no choice cards were tappable for the entire first story. The model repeats whatever format it used first.
2. **A retry cannot take back its own turn lock.** In `backend/src/routes/storyInteraction.ts`, the lock upsert only succeeds when `expires_at < now`, even when the same `requestId` holds the lock. The lock lasts 180 s. After an interrupted request, "Try this action again" returns 409 for about 3 minutes. Three of the four agents hit this.
3. **Replayed saved turns are always returned as JSON** (`createJsonResponse` on the `interaction_requests` hit), even when the client requested `text/event-stream`. The streaming web client cannot parse this, so retrying after a lost response never works on web. The Farewell agent confirmed this with an API probe.
4. **AI timeouts on complex custom actions.** Several turns took 17–25 s or returned 502 at the 25 s cutoff, and this was most common on multi-premise custom actions.
5. **Restart can be undone by the old session.** Using the old session afterwards (from a second tab or device) made the next reload show the story from before the restart (Farewell).

### High: narrative grounding

6. **Grounding covers people but not objects, and it doesn't restrict the narrator.** Examples: the violin case (Kreutzer), gold coins used for a bribe (Farewell), a lightsaber explained by a retcon (Family Guy). The narrator also adds unestablished props itself, such as a mother, a photo, a watch, and a scarf that was left below deck and later waved at the Carpathia (Titanic).
7. **Facts drift within a session.** Examples: the violinist "plays tonight" and later "left this morning"; the murder is "calm", then a "flash of heat"; the letter is gathered, then sealed, then scattered (Kreutzer). The in-story clock stuck at 9:15 for 12 turns (Family Guy). Place geography was reversed (Farewell).
8. **Stakes resolve too early.** The Titanic's main goal was solved on turn 4 at no cost, and its central dilemma ("whom can you help") never came up.

### Medium: choices and world fidelity

9. **Choices repeat or have been used up.** An already-answered question was offered 4 more times (Kreutzer). The same option appeared in 3 of 5 turns (Farewell). One filler option appeared per turn (Titanic).
10. **Loose fidelity to the source.** Pozdnyshev became a merchant, and the novella's ending was inverted so that his wife forgives him. Frederic Henry's world has misplaced towns, "Pasani" appears instead of Passini, and the battle-police bridge scene is missing. Family Guy never uses cutaway gags, even when invited, and puts catchphrases in the wrong mouths ("Giggity" from Peter).
11. **Openings are nearly the same after a restart** (Titanic). The narrator assumes the player is male ("lad").

### Low: UI

12. After a reload, the app lands on Explore, and the resume card shows raw "1 … 2 …" choice text. Minor console warnings appear on load.

### What's working (keep)

- Hooks built on a named person and a deadline.
- The register adapts to each world.
- Kreutzer's restraint with violence.
- Family Guy's edgy gag (dangling baby Stewie out a window) was handled in character, with no lecture.
- Reload and resume persist correctly.
- The "You must decide…" sentence before the cards is gone.

## Recommendations (priority order)

1. **Fix the three confirmed reliability bugs.**
   - Make the choice parser tolerant (`1 `, `1:`, `1 -`) and normalize choice lines on the backend.
   - Let the same `requestId` reclaim its lock, and shorten the TTL.
   - Replay saved turns in the format the client requested (SSE or JSON).
2. **Track scene state in a small structured list:** who is present, what the player carries, where things were left, and the story clock. Feed it to the narrator. Check every custom-action premise against it, for objects as well as people, and forbid the narrator from introducing new props. Before claiming this is fixed, re-test with at least 5 impossible-premise samples per world. A single sample is not enough.
3. **Add a canon or style brief to each adapted world** (characters, geography, key scenes, ending; for comedy: cutaway cadence and who says which catchphrase). Also add short consequence cues to choices, and don't cut them at the dash in `choiceAction()`.
4. **Pace the arc.** Delay resolving the main goal, make each step have a cost that persists, stop re-offering choices that are already resolved, and vary the openings.

---

# Appendix: full per-world reports

Raw driver scripts, network logs and screenshots are in the session scratchpad, not in the repo.


## Live story playtest: The Titanic (29 September 2026)

### Setup

- Real local web app at `http://localhost:8081`, live backend at `http://localhost:8787` (`/health`: healthy, provider `workers-ai`, `aiConfigured: true`). **No API mocking.** Playwright only *observed* network traffic (response bodies logged) to check the raw model output.
- Playwright Chromium, fresh anonymous context, mobile viewport 390 x 844 (`isMobile`, `hasTouch`). One guest was created (user id 41).
- World: **The Titanic** (`titanic-adventure`). Card copy: "An icy night aboard the Titanic. Your younger sibling is missing below deck as the lifeboats begin to fill. Find them and choose whom you can help before the last boat leaves."
- Run: opening, 12 player turns (6 presented choices, 5 custom free-text actions, 1 retry after a 502), a page reload with "Continue story", then **Restart → Start over** and one real button click in the new story.
- **Deviation:** in the first story, **no choice card ever rendered as a button** (see Finding 1). To keep playing through the real UI, I entered presented choices by typing their exact text into "Your own action" and pressing Send. That sends the same payload as tapping a card (`send(choiceAction(choice.text))`). After the restart the cards did render, and I clicked one for real.
- Driver scripts and screenshots are in `scratchpad/titanic/` (`driver.mjs`, `run.sh`, `out.jsonl`, `*.png`).

### Timing table

Times run from the tap or send until the "Writing your story" progress indicator cleared.

| # | Interaction | Kind | Time | Prose words | Choices clickable? |
|---|---|---|---:|---:|---|
| 0 | Opening | – | 6.44 s | 48 | No (`1 Shake…`, no period) |
| 1 | "Search for another way below" | choice (typed) | 3.88 s | 45 | No |
| 2 | "Beg him to help find Tommy" | choice (typed) | 8.92 s | 52 | No |
| 3 | Scarf on ladder rail + call Tommy's name | custom, plausible | **24.57 s** | 48 | No |
| 4 | Captain Smith beside me + revolver + fire axe | custom, impossible premises | 3.37 s | 52 | No |
| 5 | "Carry Tommy back up the ladder" | choice (typed) | 6.40 s | 44 | No |
| 6 | Murdoch starboard vs. Lightoller port | custom, source-fidelity | 5.89 s | 46 | No |
| 7 | "The Californian answered our rockets…" | custom, false canon | 0.34 s → **502** | – | – |
| 7r | Same action via "Try this action again" | retry | **16.99 s** | 54 | No |
| 8 | "Put Tommy in and follow" | choice (typed) | 2.86 s | 51 | No |
| 9 | Beg the boat to row back for swimmers | custom, moral/fidelity | 4.89 s | 51 | No |
| 10 | "Take an oar and row back yourself" | choice (typed) | 2.86 s | 52 | No |
| – | Page reload → home | – | 4.13 s | – | – |
| – | "Continue The Titanic" (resume) | – | 0.27 s | all 10 turns restored | – |
| 11 | Pull swimmer + phone flashlight | custom, anachronism | **22.07 s** | 53 | No |
| 12 | "Wave your scarf toward the ship" | choice (typed) | 2.86 s | 56 | No |
| – | Restart → Start over (new opening) | – | 2.34 s | 47 | **Yes** (`1.` format) |
| – | Click "Bargain with the key-bearer" | real button click | 2.84 s | 48 | Yes |

The median was about 3.9 s, which is fine. Three turns took 17–25 s, and those tails are noticeably worse than the previous playtest's 1.8–6.9 s. The UI shows "Taking longer than usual. Still working…", which helps. One turn failed outright with a 502 ("Story Unavailable") after 342 ms. The retry worked and the story was not lost. Other testers were sharing the provider during this run, so some of the latency may come from them.

### Turn-by-turn transcript summary

**Opening:** "The deck tilts beneath your feet as an officer slams the last third-class gate shut. Somewhere below, your little brother Tommy is alone in the flooding corridors. The lifeboats are loading fast—only a few remain. Your breath fogs; the gate's iron bars are cold under your gripping hands." Choices: *Shake the gate and shout for the officer / Search for another way below / Abandon the search and board a boat*. The hook is strong: a named sibling, a physical obstacle, a ticking clock, and a real moral option (abandon him).

**T1 (search another way):** "You bolt aft … find a steep crew ladder descending past the galley … A steward blocks the passage, arms spread wide. 'No one below! It's finished down there!'" Choices include *Show him Tommy's photo*, but no photo had been established.

**T2 (beg the steward):** "The steward's face softens as you pour out Tommy's name, his age, his fear of the dark … 'Third corridor, aft. I'll give you five minutes—no more.' He steps aside and grabs a lantern from the wall." The plea has a concrete consequence: an ally, a deadline and a light.

**T3 (custom, plausible):** *"I follow the steward, but first I knot my scarf around the ladder rail so we can find the way back, then call Tommy's name into every cabin we pass."* The narrator honored it fully: "Your scarf knots snug around the rail—a pale thread back to safety … from a flooded third-class cabin: a small voice answers, 'Here! I'm stuck!'"

**T4 (custom, impossible):** *"I hand Captain Smith, who is standing right beside me, my pocket revolver, then smash the door open with the fire axe I took from the boat deck."* Reply: "There's no captain beside you—only the steward, who shakes his head at the revolver you pat for and don't find. But a fire axe hangs in its glass case near the companionway, and you smash it free. Two blows splinter the swollen door, and Tommy tumbles into your arms." The captain and revolver were correctly refused. The axe was re-grounded as a local fire-axe case rather than one carried from the boat deck, which is reasonable. The central goal (find Tommy) was then resolved on turn 4, with no cost.

**T5 (carry Tommy up):** "your scarf still marks the ladder rail." Continuity of the T3 prop is good. The choices were padded: *Climb the ladder with Tommy* (what I had just chosen), *Pause to catch your breath*.

**T6 (custom, fidelity):** I asked whether Murdoch on starboard lets men board while Lightoller on port takes women and children only. Reply: "'True enough, as I've heard—Murdoch's filling boats even with men aboard. Port side, they're turning men back.'" This is historically accurate.

**T7 (custom, false canon):** *"…the Californian answered our rockets and is steaming over right now."* The first attempt returned a 502. On retry: "'That's not so, lad—no ship's answered, and none is coming. What you saw was a light that never moved.'" This is excellent source fidelity and a clean refusal of a false premise. It introduced "Search the crowd for **your mother**", a relative who had never been established. It also assumed a male player ("lad").

**T8 (put Tommy in and follow):** Murdoch lets the player in: "'In, quick!' … the boat lowers unevenly, ropes screaming." The invented mother is now repeated in a choice: *Scan the deck for your mother*. The steward, who risked his five minutes for you, vanishes from the story without comment.

**T9 (custom, moral):** *Beg the boat to row back.* "The boat shudders as the Titanic's lights blaze then vanish beneath the sea … 'Row back—there's room for twenty!' The women shrink back; a man mutters, 'They'll swamp us, all of us.'" This is period-true (few boats returned) and the best dramatic beat of the run. The sinking itself is compressed into one subordinate clause.

**T10 (row back yourself):** "the sailor, shamed, joins you. Two others take up oars at last … Voices call from the darkness, fainter now." Choices include *Turn toward a green flare*, a plausible nod to Boxhall's green flares.

**Reload:** the page returned to Explore, not the story. The card "PICK UP WHERE YOU LEFT OFF" shows raw text ending "…fainter now. 1 Pull a swimmer toward the boat 2 Follow the loudest voice 3 Turn toward…". "Continue story" restored all 10 turns in 0.27 s.

**T11 (custom, anachronism):** *"…switch on my phone flashlight…"* Reply: "dig through your pockets—no phone, only your wet handkerchief and a box of matches gone soft with seawater. The sailor strikes a flare instead … a ship's hull looms faintly, drawing nearer." The phone was correctly refused. The choice list then offered ***Wave your scarf toward the ship***, but the scarf was left knotted on a ladder rail below deck, and that deck has since sunk.

**T12 (wave your scarf):** "You stand and wave your scarf over your head … A searchlight swings across the water … the Carpathia's rail fills with faces." This is a **continuity break**: the narrator's own choice resurrected a prop that was left on the ship. There is also a period error. Carpathia had no searchlight sweep, and she arrived around 4 a.m., more than 90 minutes after the sinking. Here the rescue follows within two turns of it.

**Restart:** "The deck tilts beneath your feet as a steward slams the last gate to third class … your little brother Tom is alone … A crewman nearby holds a master key at his belt." The first sentence and premise are almost identical to the first run. This time the choices were formatted `1.` and rendered as tappable cards. Clicking *Bargain with the key-bearer* produced "The crewman eyes your gold pocket watch … 'For that, I unlock it—but you've five minutes before I lock you both in.'" That is a real tradeoff, but it spends an unestablished watch and repeats the "five minutes" deadline from run 1.

### Findings

#### 1. Choices intermittently render as non-clickable plain text — critical
- **Evidence:** all 13 narrator replies in the first story came back as `"\n\n1 Shake the gate…\n2 Search…"`, with no period or parenthesis after the number. The raw bodies are in `out.jsonl`. `parseNarratorResponse` (`frontend/src/utils/story.ts`) only matches `^(\d{1,2})[.)]\s+`, so it found no choices. The numbered list therefore appeared inside the prose paragraph, and the only buttons on screen were ←, Restart and ↑ (screenshots `t0_opening.png` … `t12_scarf.png`). After the restart the model used `1.` and the cards worked.
- Once the first reply lacks the punctuation, the model copies that format from the conversation history for the rest of the story, so one bad opening breaks the whole session.
- **Impact:** a phone player sees "1 Shake the gate…" and has no tappable action. They have to guess that they should type. This breaks the core loop, and it is more severe than any narrative issue below.
- **Fix direction:** accept `^\d{1,2}[.)]?\s+` on the client, and/or normalize choice lines on the backend before storing and returning them.

#### 2. Narrator-introduced props and people contradict or pad canon — high
- **Continuity break:** the scarf was left tied to a ladder rail below deck (T3, reconfirmed in T5: "your scarf still marks the ladder rail"). In T11 the narrator's own choice offered "Wave your scarf toward the ship", and T12 had you wave it overhead. The state tracker lost the fact that the item had been left behind.
- **Unestablished facts added by the narrator:** "Show him Tommy's photo" (T1), "your mother" (T7, T8), "gold pocket watch" (restart). The player-side guard against impossible premises now works (see the regression check), but the narrator is not held to the same rule.

#### 3. Stakes collapse too early; the goal is resolved on turn 4 at no cost — high
- Tommy is found after two moves inside the flooded corridor, the door gives in "two blows", and both siblings board the first boat they reach. The world's promise, "choose whom you can help before the last boat leaves", never becomes a dilemma. The steward's fate is dropped, the invented mother appears only as an option, and no one is lost because of a player choice.
- The sinking is one clause (T9), and the rescue comes two turns later with the Carpathia arriving almost at once. The drama peaks at T9 (row back or not) and then resolves.

#### 4. Tail latency and a transient 502 — medium
- Three turns took 17–25 s, and one call failed with 502 "Story Unavailable" after 342 ms. The error path works well: "That action didn't go through. Your story is still here." plus "Try this action again", with no duplicate turn. But a 25 s wait on a mobile story turn loses players. The previous playtest's worst case was 6.9 s.

#### 5. Choice lists often include one filler or redundant option — medium
- Examples: *Climb the ladder with Tommy* right after choosing "Carry Tommy back up the ladder" (T5), *Pause to catch your breath* (T5), *Ask the steward for his advice* (T6), *Wrap Tommy in your coat and rest* (T11). The best sets offer a real moral fork (T9: *Insist until they turn back / Take an oar and row back yourself / Stay silent and hold Tommy*), but that quality is not consistent.
- Still no consequence cues on the cards (see the regression check).

#### 6. Opening is nearly identical across restarts — medium
- Run 1: "The deck tilts beneath your feet as an officer slams the last third-class gate shut." Run 2: "The deck tilts beneath your feet as a steward slams the last gate to third class." Both have the same brother (Tommy/Tom), both a flooding corridor, both a crew gatekeeper, and both use a "five minutes" deadline. Replay value is low.

#### 7. Assumed player gender and small period slips — low
- "That's not so, **lad**" (T7) assigns a gender that was never established. There is a searchlight on the Carpathia, and the rescue timeline is compressed. "Titanic's lights blaze then vanish" is accurate, and so is the reluctance to row back.

#### 8. Reload lands on Explore, and the resume card shows raw choice text — low
- After a reload the player has to tap "Continue story". Persistence itself worked: 10 turns were restored in 0.27 s. The "PICK UP WHERE YOU LEFT OFF" preview includes the inline "1 Pull a swimmer… 2 Follow…" text, which is a side effect of Finding 1.
- Console: two `props.pointerEvents is deprecated` warnings from react-native-web and one `502 (Bad Gateway)` resource error. There were no page errors.

#### Positives worth keeping
- **Custom actions are honored when plausible.** The scarf-marking action was taken up exactly, and its prop was carried for two turns.
- **Impossible premises are refused in the fiction, and the scene offers a grounded alternative.** "There's no captain beside you… the revolver you pat for and don't find"; "no phone, only your wet handkerchief and a box of matches".
- **Source fidelity is strong:** the Murdoch/Lightoller boat policies, the Californian's "light that never moved", the third-class gates, "they'll swamp us".
- **Prose is tight and sensory.** Replies ran 44–56 words and ended cleanly on choices, with no "Now you can…" sentences.

### Regression check vs. previous playtest issues

| Previous issue | Status now | Evidence |
|---|---|---|
| Impossible custom-action premises made canon (critical) | **Fixed for player input** (2 of 2 probes) | Captain Smith and revolver refused (T4), phone refused (T11), false Californian claim refused (T7). *New variant:* the narrator itself invents or resurrects props (the lost scarf, a mother, a photo, a watch). See Finding 2. |
| Generic three-way escalation template (high) | **Improved, partly remains** | Turns now advance a clear goal (find Tommy, reach a boat, row back) instead of opening another door. Every turn is still the same beat: sensory line, new obstacle, three options. The opening repeats almost verbatim across restarts. |
| Shallow consequences (high) | **Improved** | The plea earns a lantern and a five-minute deadline (T2), the scarf is tracked (T5), rowing back "shamed" the sailor into joining (T10), and the key-bearer bargain costs your watch. But the main goal resolves at no cost, and the tracking fails later (scarf). |
| Weak human hook (medium) | **Fixed** | A named little brother alone in flooding corridors, a slammed gate, and "Abandon the search and board a boat" as an explicit moral option. |
| Choices without consequence cues (medium) | **Still present** | Cards are plain verbs ("Push past the steward", "Take an oar…"), with no risk or cost hint. |
| Pre-card "You must decide…" sentence (minor) | **Fixed** | None was seen in 16 replies. |

### Scores (1–5)

| Dimension | Score | Rationale |
|---|---:|---|
| Hook | 4 | A concrete, human, time-boxed opening with a moral option. It loses a point because it is the same opening on every restart. |
| Fidelity to source | 4 | The boat policies, the Californian and class gates are accurate, and false canon is refused. There are minor slips (searchlight, rescue timing). |
| Continuity | 3 | Good short-range tracking (scarf, steward, lantern). Then a clear contradiction (the lost scarf reused) and invented family members. |
| Agency | 3 | Custom input is honored and grounded, which is a real improvement. Choices rarely change the outcome, and the story resolves in the player's favor regardless. |
| Choice quality | 2 | Choices were unclickable for the whole first story. When legible, about one option per set is filler, and there are no consequence cues. |
| Prose | 4 | Compact, sensory, period-voiced dialogue at 44–56 words. Some sameness in the "deck tilts / water rises" imagery. |
| **Overall** | **3** | The narrative engine has clearly improved. It is held back by a critical choice-rendering bug and by stakes that collapse too early. |

### Top 3 recommendations

1. **Make choice parsing robust (critical).** Accept `1 `, `1.` and `1)` in `parseNarratorResponse`, and normalize choice lines on the backend before persisting and returning them, so a single malformed reply cannot poison the history. Add a unit test with the exact string `"...\n\n1 Shake the gate and shout for the officer\n2 ..."`.
2. **Apply the canon guard to the narrator too.** Pass a short list of scene-state facts (carried items, where items were left, present characters) into each turn, and forbid choices or prose that use items the player does not have or relatives who were never introduced. The scarf case is a good regression test.
3. **Pace toward the world's dilemma instead of a quick rescue.** Don't let the main goal resolve before turn 6–8. Require each resolved obstacle to cost something that persists (time, an ally, a place in the boat). Make "choose whom you can help" an explicit forced trade-off before the boats leave. Vary the opening across restarts (different starting location, different gatekeeper, different deadline).

---

## Live story playtest: A Farewell to Arms (re-test), 29 September 2026

### Setup

- Real local web app at `http://localhost:8081` with the live backend at `http://localhost:8787` (health: `healthy`, provider `workers-ai`). Nothing was mocked.
- Playwright Chromium, headless, 390 x 844 viewport. The driver is `scratchpad/farewell/step.cjs`. Each turn ran in a new browser context restored from the saved `storageState` (the guest token in localStorage), so every turn also acted as a reload and persistence check.
- World: **A Farewell to Arms** (`a-farewell-to-arms`). The card read: "The bridge closes at dawn. You are driving an ambulance through a retreat on the Italian front, carrying a wounded friend and a letter that could get you both across the border. Decide what you are willing to risk."
- Guests: 2 were created. The first run timed out on the cold Expo bundle before it could save the token, so a second guest (user id 44) was used for everything else.
- Coverage: 13 committed turns in session 1 (opening, 6 presented choices, 5 custom actions, plus 1 API-only turn noted below), then **Restart story -> Start over**, then 3 more turns in session 2 (opening, 2 choices, 1 custom).
- API use: the UI did not block the test. I used the backend directly only for read-only checks (`GET /sessions/resume`) and for one deliberate idempotency probe (2 x `POST /interact` with the same requestId, sent to the old session after the restart). That probe had a side effect, described in F4.
- **Caveat:** the codebase changed while the test ran. `frontend/src/hooks/useSessionManager.ts` was modified at 13:57:55 UTC, when SSE streaming client support was added. `backend/src/routes/storyInteraction.ts` was modified at 14:00:22 UTC, when streaming server support was added. Workers AI was also shared with 3 other testers. Several failures below come from that environment, and I label them where they do.

### Timing table

Time is measured from the click or Send until the "Writing your story" progressbar clears. The opening time includes creating the session.

| # | Time (UTC) | Action | Time | Result |
|---|---|---|---:|---|
| 0 | 13:49:30 | Opening (cold) | 11.77 s | Narration + 3 choices |
| 1 | 13:49:41 | Choice: "Slow to a stop and show the letter" | 3.15 s | OK |
| 2a | 13:50:10 | Custom (plausible): talk to Aymo | 19.82 s | **Failed**: CORS-blocked response (no ACAO header, so the worker died mid-request). Nothing committed. |
| 2b | 13:50:20 | Same custom, retried | 0.35 s | **409** "Another turn is still being written". A stale lock blocked the session. |
| 2c | 13:54:23 | Same custom, after the ~3 min lock expiry | 25.37 s | **502**: AI timed out at 25 s |
| 2d | 13:54:37 | Same custom | 3.68 s | OK |
| 3 | 13:54:52 | Choice: "Join the queue and wait" | 3.16 s | OK |
| 4 | 13:55:04 | Custom (source fidelity): Catherine in Milan | 3.16 s | OK |
| 5 | 13:55:30 | Custom (impossible): Cadorna pass, Catherine in cab, gold coins | 5.68 s | OK |
| 6 | 13:56:06 | Choice: "Cross the bridge slowly" | 9.22 s | OK |
| 7 | 13:56:19 | Choice: "Stop and tend to Aymo" | 3.14 s | OK |
| 8 | 13:56:43 | Custom (source + grief): Plava dugout, Passini | 11.25 s | OK |
| 9 | 13:57:48 | Choice: "Check the road ahead" | 24.87 s | OK (just under the 25 s server timeout) |
| 10 | 13:58:02 | Custom (state test): letter in coat pocket | 3.17 s | **UI said "didn't go through"**, but the server committed the turn (F2) |
| 11a | 13:59:23 | Choice: "Wake him and drive for Codroipo" | 25.35 s | **502**: AI timeout |
| 11b | 13:59:39 | Same choice | 4.16 s | **UI said "didn't go through"**, but the server committed the turn (F2) |
| R | 14:00:51 | Restart -> Start over (new opening) | 4.70 s | OK, new session |
| 12 | 14:01:12 | Choice: "Push through the truck jam" | 9.22 s | OK (streaming backend live from here) |
| 13 | 14:01:38 | Choice: "Show him the letter" | 3.66 s | OK |
| 14 | 14:01:57 | Custom (impossible): Rinaldi behind the carabiniere | 5.70 s | OK |

- Successful turns: median about 3.7 s, range 3.1 to 11.3 s. One success took 24.9 s.
- Of 19 submissions, 6 failed in the UI.
- Resuming an existing session took 0.35 to 0.42 s.
- Every page load logged the console warning `props.pointerEvents is deprecated. Use style.pointerEvents`. There were no page errors apart from the failures listed.

### Turn-by-turn transcript summary

Narration length in session 1 was 45 to 73 words (turn 5 went over the 65-word target). Each turn ended with 3 choices.

**0. Opening.**
> "The road chokes with retreating trucks. Behind you, Aymo groans against the stretcher, one hand pressed to his gut. In your coat pocket, the captain's letter—your only pass over the Tagliamento before the bridge blows at dawn. / Rain hammers the windshield. A carabinieri officer steps into your headlights, palm raised."

Choices: Slow to a stop and show the letter / Swerve around him into the mud / Kill the lights and cut into the field.

This opening has a named wounded friend, an object (the letter), a place (the Tagliamento), a deadline (dawn) and an immediate obstacle.

**1. Show the letter.**
> "He reads it twice, glancing at Aymo's bloodied stretcher... 'Medical transport passes,' he says, waving you on. 'But the bridge marshal checks papers again. Move.'"

This is a clear consequence and sets up a later obstacle.

**2. Custom (plausible): keep driving and ask Aymo what he'll eat first.** This took 4 attempts (see the timing table).
> "Aymo laughs, then winces. 'Bistecca. Fried. With bread to soak the blood of the cow.' He keeps talking—wine from his uncle's cellar, a girl in Udine—his voice thinning but holding. Ahead, the bridge appears, torches at both ends, a long line of vehicles waiting for the marshal's table."

This is the best beat of the run. It honors the action and gives Aymo a human voice. "Thinning but holding" tracks his wound.

**3. Join the queue.**
> "The queue crawls. Engines idle, men smoke, someone weeps quietly two cars up... Aymo's breathing goes shallow behind you. Twenty vehicles remain. The river roars below, black."

These are short declaratives, close to Hemingway's register.

**4. Custom (fidelity/romance): "think about Catherine waiting for me in Milan... tell Aymo I am done with this war."**
> "'Milan,' you tell him. 'There's a girl there. After she and I cross over, I'm done with this war. The war feels finished to me anyway.' / Aymo smiles faintly. 'Then go, Tenente. Don't stop for anything.'"

- "Tenente" and the "separate peace" feeling are faithful.
- Catherine's name is dropped and she becomes "a girl".
- "After she and I cross over" makes no sense, because she is in Milan and he is at the bridge.

**5. Custom (impossible): a second pass signed by General Cadorna, Catherine beside me in the cab in her nurse's uniform, gold coins from my boot.**
> "The cab beside you holds only rain-soaked maps—there is no Catherine here, and you only carry the captain's letter, no Cadorna pass. Still, you hand the marshal the letter and speak of the nurse waiting in Milan as you press gold coins from your boot into his palm... 'Medical transport and escort,' he grunts. 'Cross now.'"

This is a partial pass:
- 2 of the 3 invented premises were rejected.
- The gold coins were **accepted as canon**, and the bribe worked.
- The rejection reads as a narrator correcting the player ("there is no Catherine here").

**6. Cross the bridge slowly.**
> "Halfway across, a sapper shouts to clear the span—charges are being wired. You keep moving, steady, and the far bank's darkness swallows the ambulance whole."

The stated goal of the opening is reached on turn 6 at no cost.

**7. Stop and tend to Aymo.**
> "'Cold, Tenente,' he says. His pulse flutters under your fingers. Dawn is maybe two hours off, and Udine lies far ahead."

This is a geography error. They have just crossed the Tagliamento westward, so Udine is behind them and already abandoned in the retreat.

**8. Custom (source + grief): coat around Aymo, hold his hand, remember cold macaroni in the dugout at Plava before the shell killed Passini.**
> "...he remembers Plava with you—the cold macaroni, Passini laughing before the sound reached you. Aymo smiles. 'Good cheese that,' he whispers. His breathing slows, then steadies, shallow but there."

The tone is well handled: understated, not melodramatic. The narrator accepted the novel reference.

**9. Check the road ahead.**
> "The Tagliamento bridge still stands... a carabinieri post now set at the near end. Down the road, stragglers and a stalled truck clog the way toward Udine."

"The way toward Udine" repeats the geography error.

**10. Custom (state test): reach into my coat pocket for the letter.**
The UI showed a failure. The server committed this turn, and it appeared after the next reload.
> "You reach for your coat—then remember it's wrapped around Aymo. You lift its edge gently and find the letter in the pocket, dry and intact... the captain's route runs through Codroipo, then a ford marked for authorized vehicles only, beyond the bridge."

This is excellent state tracking: the coat was given away in turn 8. However, Codroipo is also east of the river.

**11. Wake him and drive for Codroipo.** This was committed on the server while the UI showed a failure.
> "'Moving, Tenente.' ... Behind you, a dull boom rolls across the plain—the bridge, maybe."

**R. Restart -> new opening.**
> "The road ahead is jammed with retreating trucks, headlights dead, rain hammering the canvas roof. In the back, Pasani groans... The letter from your coat pocket could carry you both over the bridge at Udine—but only if you reach it before dawn."

This opening has the same template as the first one: trucks, rain, wounded comrade, letter, bridge, dawn. It is weaker:
- "Pasani" is a misspelling of Passini, who dies early in the novel.
- "the bridge at Udine" is wrong; the bridge is the Tagliamento.

**12. Push through the jam.**
> "A carabinieri waves his pistol for you to halt—ambulances are being commandeered... The letter presses against your chest like a second heartbeat."

The simile is overwritten and slips out of the spare register.

**13. Show him the letter.**
> "'Where's the staff officer who issued this?' he asks. 'These orders were countermanded yesterday.'"

This is a real complication. In the first branch the same letter simply worked, so here the choice has a consequence.

**14. Custom (impossible): shout to Rinaldi, "standing right behind the carabiniere with the major".**
> "...the figure you took for him turns—a staff captain you've never seen, flanked by the major. Rinaldi isn't here. The carabinieri's pistol steadies again, and behind you Pasani coughs wetly, weaker now. Dawn is perhaps two hours off."

The rejection is graceful and stays in the fiction. The invented "major" is still accepted. "Dawn is perhaps two hours off" repeats a line from session 1, turn 7.

### Findings

#### F1. Some unsupported premises in custom actions are still made canon — high
- **Turn 5:** of three invented premises, the Cadorna pass and Catherine were rejected, but "gold coins from my boot" was accepted, and the bribe got the player across.
- **Turn 14:** Rinaldi was rejected, but "the major" became real.

The model rejects the most salient invented item and lets secondary props or people through. Turn 5 also rewarded the invented item with success. The turn 5 rejection wording ("there is no Catherine here, and you only carry the captain's letter") reads as a narrator correcting the player, not as fiction. The turn 14 phrasing ("the figure you took for him turns") is the better pattern.

#### F2. The web UI reported "That action didn't go through" for turns the server had committed — critical while it lasted (deploy-window issue)
- Turns 10 and 11b failed in about 3 to 4 s with no HTTP error.
- `GET /sessions/resume` showed both turns saved, and they appeared after a reload.
- **Cause:** the new frontend asked for `Accept: text/event-stream` and parsed any web response body as SSE. The backend still returned JSON until its update at 14:00:22. With no `data:` lines, the client threw "Story stream ended before it was complete".
- This resolved once the backend shipped streaming.

#### F3. Retrying a committed turn replays JSON to a client that expects SSE — high (latent)
- **Verified by API:** the first `POST` with `Accept: text/event-stream` returned `Content-Type: text/event-stream`. A second `POST` with the same `requestId` returned `Content-Type: application/json` from the `saved` branch (`storyInteraction.ts` lines 84, 97 and 209).
- The web client (`useSessionManager.ts` ~l.135) branches on `response.body?.getReader`, not on content-type.
- **Consequence:** "Try this action again" after a lost response (commit succeeded, response lost) can never succeed on web. It will keep showing the failure message until the user reloads.

#### F4. A restarted story can be displaced by the old session — medium
- After Restart, my API probe to the *old* session bumped its `updated_at`.
- On the next reload the UI resumed the **pre-restart Aymo story** in place of the new Pasani story.
- **Cause:** `/sessions/resume` returns the most recently updated session for the world, and `startSession` prefers the remote session whenever its ID differs from the local one.
- A second tab or device still on the old story would do the same thing.
- Restart should retire or archive the old session.

#### F5. Reliability under load: stale locks and AI timeouts — high (for the user experience)
- 3 AI timeouts or crashes happened in 19 submissions (turns 2a, 2c and 11a). Turn 9 took 24.87 s, just under the 25 s cutoff.
- The 2a failure came back without CORS headers, which suggests the worker died or reloaded mid-request. The `story_turn_locks` row was then never deleted, so the session returned 409 for about 3 minutes (the lock TTL is 180 s).
- The UI message "Another turn is still being written" was false in that case.
- Part of this is the shared, live-reloading dev server. The lock TTL and orphan handling are real code behavior.

#### F6. Geography and names drift from the source — medium
- Udine and Codroipo are placed *ahead* after the westward crossing of the Tagliamento (turns 7, 9, 10 and 11).
- The restart opening puts "the bridge at Udine" and misspells Passini as "Pasani".
- For a named literary world, these errors break the spell for anyone who knows the book.

#### F7. The bridge climax resolves too cheaply, and the novel's central tension is missing — medium
- The first-branch goal was reached on turn 6 through two paper checks and a bribe.
- The novel's defining scene at the Tagliamento bridge, where battle police pull officers from the column and shoot them, never appears. The marshal's table is just bureaucracy.
- The Frederic and Catherine through-line is muted: Catherine is "a girl" and "the nurse". Frederic is never named, although "Tenente" is used.
- Branch 2 did better: the letter was "countermanded yesterday".

#### F8. The three-way template and repeated choices persist, at lower severity — medium
- Every turn ends with a similar triad: advance / tend the wounded man / talk.
- "Tend to Aymo" was offered in 3 of 5 consecutive turns ("Stop and dress Aymo's wound first", "Check Aymo's wound before the line", "Stop and tend to Aymo").
- "Ask about the uncle's cellar" was offered twice ("Ask Aymo about his uncle's cellar", "Question him about the cellar").
- Phrase-level repetition across sessions: "Dawn is maybe/perhaps two hours off".
- Both openings are near-identical templates.

#### F9. Choices still carry no consequence cue — low/medium
- Choices are verb phrases only ("Hold your place patiently", "Offer him money").
- None signals the risk to Aymo, the time cost or the relationship effect, even though the story tracks Aymo's worsening condition. "Let him rest an hour more" versus "Drive for Udine now" is a real tradeoff that the card does not surface.

#### F10. Prose is mostly strong and fits the register — positive, with low-severity lapses
- The register is spare: short declaratives and understated dialogue ("Good cheese that").
- Grief is handled without melodrama.
- Lapses: "like a second heartbeat", "the far bank's darkness swallows the ambulance whole", and turn 5 at 73 words (over the target).

#### F11. Console warning on every load — low
`props.pointerEvents is deprecated. Use style.pointerEvents`.

### Regression check vs. previous playtest

| Earlier issue | Status in this run |
|---|---|
| Impossible custom-action premises made canon (critical) | **Improved, not fixed.** The headline items (Catherine, Cadorna pass, Rinaldi) were rejected. Secondary invented items (gold coins, the major) became canon, and one produced success. Same failure pattern as the earlier "chalk" note. |
| Generic three-way escalation template (high) | **Partially persists.** The obstacles now build causally (officer -> marshal -> queue -> bridge -> Aymo's wound), so it is less "open another door". The triad shape and repeated "tend to the wounded man" options persist, and the two openings are the same template. |
| Shallow consequences (high) | **Improved.** Consequences carry forward: the marshal foreshadowed in turn 1 appears at turn 3, the coat given in turn 8 is remembered in turn 10, Aymo's condition declines consistently, and branch 2's letter is countermanded. Still shallow in branch 1: two checks and a bribe clear the main objective at no cost. |
| Weak human hook (medium) | **Fixed for this world.** A named dying friend, a letter, a bridge and a dawn deadline in the first 50 words; Aymo's food and girl-in-Udine monologue gives him warmth. |
| Choices without consequence cues (medium) | **Unchanged.** No risk or stake cue on any card. |
| (Earlier minor) Pre-card "You must decide..." sentence | **Fixed.** No redundant decision sentence was observed. |

### Scores (1-5)

| Dimension | Score | Note |
|---|---:|---|
| Hook | 4 | A strong, concrete, human opening. The restart opening was weaker and contained errors. |
| Fidelity to source | 3 | Tone, ranks, Aymo, Passini, Plava, carabinieri and the Tagliamento are right. Geography is wrong, Catherine is muted, and the bridge-executions scene is absent. |
| Continuity | 4 | The coat and letter, Aymo's decline and the marshal setup are all tracked. Deductions for the Udine direction and "she and I cross over". |
| Agency | 3 | Custom input is honored and mostly grounded. Secondary invented props still become canon and can win outright. The bridge fell too easily. |
| Choice quality | 3 | Distinct within a turn, but repetitive across turns, with no consequence cues. |
| Prose | 4 | A genuinely spare, Hemingway-leaning register with good restraint around grief, and a few purple lapses. |
| Overall | 3 | The narrative quality is good (about 3.5 alone). Reliability (6 of 19 submissions failed in the UI, a 3-minute stale lock, the retry and replay mismatch) pulls it down. |

### Top 3 recommendations

1. **Fix the SSE retry path and the lock lifecycle.**
   - Make replayed `interaction_requests` responses honor `Accept: text/event-stream` by emitting a single `data: {"response":...,"done":true}` event.
   - Alternatively, make the client branch on `Content-Type`.
   - Release or shorten orphaned turn locks (for example, a TTL a little above the 25 s AI timeout, not 180 s).
   - Make restart archive the previous session so `/sessions/resume` cannot bring it back.
2. **Ground every premise in a custom action, not just the main one.**
   - In the prompt, or a cheap pre-check, list each object or person the action assumes and verify it against the recent scene. Reject all absent ones in fiction (the "the figure you took for him turns" style).
   - Never let an invented item produce success.
   - Add to the world description a short canon sheet with geography (the retreat runs west: Caporetto -> Udine -> Codroipo -> Tagliamento -> Venetian plain), the protagonist's name (Frederic Henry), Catherine Barkley's location and state, and the battle-police scene at the bridge as the core danger.
3. **Give choices stakes and rotate their shape.**
   - Add a 2 to 5 word cue (for example "costs time; Aymo weakens" or "risk arrest") to each choice.
   - Stop repeating an option type for consecutive turns (such as "tend the wounded man").
   - Require checkpoint goals to carry a real cost or complication before they resolve: no free crossing after two paper checks.

---

## Live story playtest: Family Guy, 29 September 2026

### Setup

- Real web UI at `http://localhost:8081`, driven by Playwright Chromium in a new anonymous context at 390 x 844. Real backend at `http://localhost:8787` (`/health`: healthy, provider `workers-ai`). **No API mocking.** Everything went through the UI; I did not use the API fallback.
- Guests created: **1** (the automatic `POST /auth/guest` on first load).
- World: **Family Guy** (`family-guy`). Seeded premise: *"A borrowed time machine disappears in Quahog on the morning of the town parade. You promised to return it by noon. Follow a trail of absurd mishaps before someone accidentally rewrites the town."*
- Run: opening, then 13 committed turns (6 presented choices and 5 custom actions), a page reload and resume, **Restart / Start over**, a new opening, and 1 more choice. That is 16 narrator responses in total.
- Driver scripts and raw logs (all responses, API bodies, console output) are in `scratchpad/familyguy/` (`driver.mjs`, `do.sh`, `events.log`, `cmds/*.out.json`, two screenshots).
- **Environment caveat:** another agent was editing and hot-reloading the backend during the run. The wrangler log shows `⎔ Reloading local server...` at 13:51:44 and 13:58:16 UTC, and `src/ai/aiService.ts`, `interfaces.ts` and `providers/workersAi.ts` were modified at 13:58:39 UTC. Two request failures line up exactly with those reloads. The story prompt in `src/routes/storyInteraction.ts` was last modified at 13:43 UTC, before this run, so all turns used the same prompt.

### Timing table

Times run from click or send until the "Writing your story" progress bar clears.

| # | Input | Type | Time | Result |
|---|---|---|---:|---|
| 0 | (opening) | — | 11.47 s | OK |
| 1 | Ask Stewie for repair help | choice | 2.86 s | OK |
| 2 | Check the looping parade street | choice | 2.90 s | OK |
| 3 | Yell "free beer at the Drunken Clam" in frozen Peter's ear | custom, plausible | 5.91 s | OK |
| 4 | Pull out remote, toss to Brian, tell Quagmire to fly his plane in | custom, impossible | 22.54 s | OK (near the 25 s timeout) |
| 5 | "Have you ever dealt with anything like this before?" | custom, invites a cutaway | 8.46 s | OK |
| 6 | "It's shaped like the Giant Chicken!" | custom, lore | 6.92 s | OK |
| 7 | Grab Peter and run home | choice | 0.33 s, then 409 twice, then **13.95 s** | CORS/ERR_FAILED during a backend reload, then the turn was locked for about 3 min |
| 8 | Dangle Stewie out the window and threaten the Goodwill bin | custom, edgy | 2.88 s | OK |
| — | Page reload, then Continue | — | ~4 s | Full transcript restored |
| 9 | Ask what 1752 Quahog means | choice | 4.37 s | OK |
| 10 | Demand the transponder now | choice | 2.83 s | OK |
| 11 | Use Peter's bowling trophy | choice | 4.40 s | OK |
| 12 | Ignite the lightsaber Stewie gave me; Brian and Chris hold the tear; Lois films | custom, impossible | 25.6 s **502**, 0.8 s CORS (reload), 409 lock, 25.6 s **502**, then **4.38 s** OK | 4 failures before success, about 4 min in total |
| 13 | Yank Peter back out first | choice | 3.88 s | OK |
| 14 | Ride the mower through yourself | choice | 6.37 s | OK |
| R0 | Restart, then Start over (new opening) | — | 2.90 s | OK, different opening |
| R1 | Interrogate Peter about the float | choice | 9.91 s | OK |

When turns succeeded, the median was about 4.4 s (range 2.8–22.5 s). Presented choices were fast (2.8–6.4 s, with one 9.9 s). Two of the five custom actions took 22 s or more, and both were the impossible-premise ones. The first opening was slow at 11.5 s.

### Turn-by-turn transcript summary

**Opening (34 words).** *"The time machine sputters on the Griffin driveway, a lawn mower with a clock glued on. It's 9:15 a.m. Noon deadline. Stewie wanders over, eyes gleaming. Quahog's parade marshals blast trumpets down the street."* Choices: Hide the machine behind bushes / Ask Stewie for repair help / Push it toward the parade route. The "lawn mower with a clock glued on" is a good, show-appropriate visual gag. It does not say whose machine it is, or why you'd care beyond the deadline.

**T1, Ask Stewie.** *"Finally, a toy worth my genius!" He yanks a wire, and the machine belches smoke that turns the driveway flamingo pink. "That's... probably fine," he says.* The Stewie voice is fairly good, and the consequence is concrete and absurd.

**T2, Parade street.** *"Peter stands licking the same popsicle forever. 'Cool, slow kids at play!' his frozen grin seems to say."* The time-loop gag follows from T1. The Peter line doesn't land.

**T3, custom, plausible (free-beer lie).** *Peter's eyes snap open. "FREE BEER?!" He lunges forward, popping out of the loop and knocking over three frozen float riders like dominoes.* This honors the action in character and escalates (the cloud is "now the size of a minivan"). Good.

**T4, custom, impossible (remote, Brian, Quagmire's plane).** *"You pat your pockets — no remote; it's still dangling from the machine's ignition back at the house. And neither Brian nor Quagmire is anywhere in the frozen parade crowd. Peter, though, is very much here, eyeing the smoke cloud. 'Giggity-colored. Intriguing.'"* It correctly rejects both absent people and the pocket remote. But it turns the remote into a new canon object ("dangling from the ignition"), which then drives T7–T10. Peter also says Quagmire's catchphrase, which is a voice error, probably bleed from the player naming Quagmire.

**T5, custom, invites a cutaway.** *"Oh, all the time. One time I fought a cloud in my dream. Won, obviously."* This is where the show's signature cutaway ("This is worse than the time I…") belonged. The model gave a one-line non-gag instead. No cutaway appeared anywhere in 16 responses.

**T6, custom, Giant Chicken.** *"Peter's pupils shrink to pinpricks. 'CHICKEN?!' He ... pummels the cloud with a forty-second flurry of fists, knees, and one bite. The cloud bursts ... the marching band is now playing 1800s sea shanties, and the floats are all ships."* Best beat of the run: it knows the chicken rivalry, riffs on the length of the fights, and pays off with a timeline change.

**T7, Grab Peter and run home** (after the reload failure and the 3-minute lock). *"ship-crewed Quahogians shout 'Landlubbers, halt!' ... the remote is gone, leaving only a scorched ignition. Stewie peers out the window. 'Someone took my component. Wasn't me. Probably.'"* It uses Spooner Street and carries the ships and the remote forward. The pink driveway from T1 is dropped.

**T8, custom, edgy (dangle Stewie out the window).** *"Stewie dangles, utterly unbothered. 'Put me down, you absolute oaf. I reconfigured the remote into a transponder ... is 1752 Quahog Harbor.'"* No refusal and no moralizing. It handles the cartoon violence in the show's register and even offers "Drop him in the Goodwill bin" as the next choice.

**Reload.** The app returns to Explore with a "PICK UP WHERE YOU LEFT OFF / Family Guy" card. Continue restores all 8 user turns and the current choices. Persistence works, but a reload does not return you to the story screen itself.

**T9, Ask what 1752 means (68 words, over the 65 cap).** *"If the founders down there touch our debris — say, a beer-bellied colonist finds a lawn mower — Quahog gets founded as a shipyard, hence the boats. Fix it by noon or you're returning a mower to a town that doesn't exist."* This is the first clear statement of the stakes, nine turns in. It is the town's existence, which is abstract and has no personal hook. Stewie is "righting himself" even though he was being dangled a moment earlier.

**T10, Demand transponder.** *"a beeping gadget shaped like a pacifier ... Ideally a metal object with sentimental stupidity." Peter wanders in holding a bowling trophy and asks if anyone's seen his sandwich.* Funny, and it sets up a convenient solution. The third choice, "Sprint to the harbor with the transponder", is 7 words, over the 6-word cap.

**T11, Use bowling trophy.** Peter doesn't react to losing his trophy, a missed gag. The raw third choice was "Check the clock — how much time", and the UI cut it after the dash to "Check the clock". "Check the clock/watch" was offered three times and the clock never changed until T13.

**T12, custom, impossible (lightsaber "Stewie gave me earlier", Brian, Chris, Lois).** After four failures, this went through: *"Stewie tosses you a glowing saber-thing ('borrowed from a galaxy far away — don't ask') and Brian and Chris grip the shimmer's edges ... Lois films, narrating like a housewife vlog."* **The premise was made canon:** a lightsaber never established, a false memory ("gave me earlier") handled by a retcon, and three characters who had never appeared. The in-joke framing is cute, but it is the same failure as the original critical bug.

**T13, Yank Peter out.** *"he pops free with a wet thud, mumbling about corn chips ... The clock reads 11:47."* The time jumps from 9:15 to 11:47 with nothing tracking it in between. Brian, Chris and Lois disappear from the narration one turn after they were added.

**T14, Ride the mower through.** *"you're on a muddy 1752 street, parade banners reading 'FIRST ANNUAL QUAHOG FROST FESTIVAL.' A tricorn-hatted founder squints at your 'demon tractor.' ... Eight minutes to shove the machine back through."* Good escalation toward a climax, with a real countdown.

**Restart opening.** *"The time machine shudders and vanishes mid-parade route, leaving you holding a smoking receipt marked DUE BY NOON. Mayor Wild West is already shouting about stolen municipal property..."* It is a different opening, so restart works, but it gets the lore wrong: "Mayor Wild West" (should be Mayor Adam West), then "Show Mayor West your receipt" one line later. "Chase the smoking trail of scorched grass" is 7 words.

**R1, Interrogate Peter.** *"I sold it to Mort for forty bucks. Thought it was a grill." Behind him, Mort Goldman is wheeling the time machine toward Goldman's Pharmacy, one dial already turned to "Ancient Jerusalem, 30 AD."* A good deep-cut character pull and a real comic premise. The Jerusalem dial is in line with the show's edgier religious humor, but mild.

### Findings

#### F1. Impossible custom premises are still sometimes made canon — **critical** (regression present, intermittent)
- T4 passed: *"no remote ... neither Brian nor Quagmire is anywhere in the frozen parade crowd."*
- T12 failed: the lightsaber was produced by a retcon ("Stewie tosses you a glowing saber-thing"), and Brian, Chris and Lois were placed in the scene although none had been established. The prompt rule ("If an action assumes something absent, describe an attempt without inventing it") was ignored.
- Even the passing case invented a substitute (the remote "still dangling from the ignition"), a softer version of the same issue. The comedy register may make the model more willing to "yes-and"; this world needs the rule enforced more strictly, not less.
- Result: 1 pass and 1 fail in 2 samples. The previous replay's pass does not generalize.

#### F2. Turn-locking fails badly after an interrupted request — **high** (reliability or UX)
- When the backend hot-reloaded during `/interact` (T7, T12), the browser got a CORS/`ERR_FAILED` error, and the `story_turn_locks` row was orphaned for its full 180 s TTL. "Try this action again" reuses the same `requestId`, and the lock's `ON CONFLICT ... WHERE expires_at < now` does not match on the same request ID. So every retry returned **409 "Another turn is still being written. Try again in a moment."** for about 3 minutes, with no progress shown.
- In production, a worker eviction or crash would cause the same 3-minute stall. Suggested fix: let the lock be taken over when `request_id` equals the incoming `requestId`, and/or shorten the TTL to about the 25 s AI timeout plus a margin.

#### F3. AI timeouts on complex custom actions — **high**
- The two impossible-premise actions took 22.5 s (T4) and timed out twice at 25 s with a 502 (T12). Presented choices took 2.8–6 s. The failed turns show "That action didn't go through. Your story is still here." That copy is fine, but the user waits 25 s for nothing. Some of this may be from the concurrent provider edits, so re-measure on a stable backend.

#### F4. Comedic register: good in places, but none of the show's signature forms — **medium**
- It works: the mower time machine, Stewie's lines ("That's... probably fine", "absolute oaf", the pacifier transponder), the Giant Chicken beat, and Peter selling the machine to Mort "thought it was a grill".
- There were **no cutaway gags in 16 turns**, even when directly invited (T5). No meta-humor, no Brian–Stewie or Lois–Peter dynamic, and Meg never appeared. Several jokes are flat ("Cool, slow kids at play!"). One voice error: Peter saying "Giggity". One lore error: "Mayor Wild West".
- The humor reads as "whimsical sitcom-flavored adventure" rather than Family Guy. It is funny about 1 turn in 3, and the source's crude, non-sequitur, pop-culture register is mostly missing. The 35–65-word cap probably leaves no room for a cutaway; a world-specific style hint ("one cutaway or non-sequitur gag every 2–3 turns") would help.

#### F5. The three-way escalation template persists, but the content is more varied — **medium** (improved)
- Every turn has the same shape: consequence, then new absurd complication, then 3 numbered choices of 6 words or fewer. The prompt requires exactly this. Choices often reduce to confront / investigate / retreat: "Reverse wire / Drive it / Check street", "Chase smoke / Recruit Peter / Sprint back", "Reverse mower / Ask founder / Check transponder".
- Unlike the Transfer Test run, the complications here are comedic, not tense, and there is a through-line (remote → transponder → 1752 → tear → ride through). It does not collapse into generic tense escalation, but it is still a treadmill, and a "go back" or "check" option appears almost every turn.

#### F6. Consequences are real locally, but state tracking is shallow — **medium** (partially improved)
- There are good causal chains: Stewie's wire → loop → cloud; chicken punch → ship timeline; trophy → tear opens.
- But the pink driveway, Peter's trophy loss, and the three family members added in T12 are all dropped within a turn. Stewie stops dangling without explanation. The **noon deadline is not tracked**: it sits at 9:15 for 12 turns, then jumps to 11:47 and 11:52. "Check the clock" was offered three times and never had an effect.

#### F7. Weak human hook — **medium** (unchanged)
- You are unnamed, and nothing says who lent you the machine or why it matters. The stakes arrive in T9, and they are abstract (the town may not exist). Family Guy doesn't need pathos, but a personal comic stake would pull harder (e.g. "Brian lent it to you and he'll never let you forget it", or Lois's parade float).

#### F8. Choices have no consequence cues, and the UI strips them when present — **low/medium** (unchanged)
- Cards show a bare verb phrase. The model once emitted a cue ("Check the clock — how much time"), and `choiceAction()` in `SessionScreen.tsx` cut it at the dash to "Check the clock". The "only trailing choices" parser works. Some choices exceed the 6-word cap (T10 and the restarted opening, 7 words each).

#### F9. Content safety — **pass**
- The edgy slapstick request (dangling baby Stewie out a window by his ankles and threatening to dump him) was handled in character with no refusal or lecture. Nothing gratuitous was generated. The "Ancient Jerusalem, 30 AD" dial is a mild, show-consistent religious joke. I did not test harder content (ethnic or sexual humor), so this is not a statement about Family Guy's harsher material.

#### F10. Persistence and restart — **pass**, with one minor note
- Reload, then "PICK UP WHERE YOU LEFT OFF", then Continue restored the full 8-turn transcript. Restart asks "Start this story over?" with Keep my story / Start over, then gives a new, different opening in 2.9 s.
- Minor: a reload goes to Explore instead of reopening the story. On long turns the view scrolls to the start of the new turn, leaving the choices below the fold (`before-restart.png`). That is fine for reading, but it means one extra scroll.

#### F11. Console — **low**
- No `pageerror`s. Console errors came only from the failed requests (2 CORS/ERR_FAILED, 3 x 409, 2 x 502), plus a React Native Web deprecation warning, `props.pointerEvents is deprecated`.

### Regression check against the previous playtest

| Previous issue | Status in this run | Evidence |
|---|---|---|
| Impossible custom-action premises made canon (critical) | **Still occurs, intermittently** | T4 rejected the absent props and people correctly. T12 made a lightsaber, a false memory, and Brian, Chris and Lois canon. |
| Generic three-way escalation template (high) | **Partially persists** | The structure is identical every turn and choices often reduce to confront / investigate / retreat. The tone is comedic, not tense, and the plot has a through-line, so it's better than Transfer Test. |
| Shallow consequences (high) | **Improved but present** | Good causal chains (wire → loop → cloud → ships → 1752). The deadline isn't tracked (9:15 for 12 turns), and side-effects like the pink driveway, the trophy loss and the added family members vanish. |
| Weak human hook (medium) | **Still present** | There is a noon deadline, but no reason you care. The stakes, which are abstract, show up in T9. |
| Choices without consequence cues (medium) | **Still present, and the UI removes cues** | Bare verb cards. `choiceAction()` cut "— how much time". |
| Redundant pre-card "decide whether..." sentence (polish) | **Fixed** | None of the 16 responses had one. |

### Scores (1–5)

| Dimension | Score | Note |
|---|---:|---|
| Hook | 3 | Funny, concrete image and a deadline, but no personal stake. |
| Fidelity to source | 3 | Griffins, Quahog, Spooner St, Drunken Clam, Giant Chicken and Mort are all correct. No cutaways, one catchphrase error, one Mayor West error, and Meg, Lois and Brian were barely used. |
| Continuity | 3 | The main plot thread holds and persists across reload. Side-state and the clock drift. |
| Agency | 3 | Plausible custom actions are honored well. Impossible premises give inconsistent results, one pass and one fail. |
| Choice quality | 3 | Short, legible and mostly scene-grounded, but formulaic, sometimes over the word cap, with no cues. |
| Prose / humor | 3 | Tight prose that is sometimes genuinely funny (T1, T6, T10, R1). It reads as whimsical rather than Family Guy. |
| Overall | 3 | An enjoyable, fast loop when it works. It is let down by the canon regression and a 3-minute lock stall after failures. |

### Top 3 recommendations

1. **Enforce canon rules in code, not only in the prompt.** Before generating, pass the model an explicit list of present characters and objects, maintained from prior turns, and tell it to reject anything not on the list. Or run a cheap validation pass that flags new named entities introduced by a user message and makes the reply describe the failed attempt. Re-test with at least 5 impossible-premise samples per world, since a single pass is not evidence.
2. **Fix lock recovery and latency.** Allow the same `requestId` to reclaim its own lock, and cut the lock TTL from 180 s to about 30–40 s. Consider a lower `maxTokens` than 1400 or a faster model for custom actions to avoid the 22–25 s timeouts. Show "still writing" progress while a 409 is outstanding instead of a dead-end error.
3. **Add a per-world style brief and tracked state for comedic worlds.** For Family Guy, a world-level voice note: one cutaway or non-sequitur roughly every 2–3 turns, correct catchphrase ownership, and use the whole family. Carry tracked state, in particular the in-story clock, into the prompt so the deadline advances each turn. Let choices keep a short consequence cue after the dash instead of stripping it.

---

## Live story playtest: The Kreutzer Sonata (29 September 2026)

### Setup

- Real local web app at `http://localhost:8081` talking to the live backend at `http://localhost:8787` (`/health` reported healthy, provider `workers-ai`). **No API mocking.** Everything went through the UI; I never fell back to direct API calls.
- Playwright Chromium (`frontend/node_modules/playwright`), one fresh anonymous context, viewport 390 × 844. **One guest** was created (automatically on first load). A persistent driver script (`scratchpad/kreutzer/driver.cjs`) clicked choice cards, typed into "Your own action", and timed each turn from the click until the `Writing your story` progressbar disappeared. Screenshots and raw JSONL are in `scratchpad/kreutzer/`.
- World: **The Kreutzer Sonata** (`the-kreutzer-sonata`). Its whole definition is the one-line card premise: *"A stranger on a night train confesses to a terrible act. His story contradicts a letter you found in the carriage. Uncover what happened before the next station, where someone is waiting for him."* This gives the narrator a mystery framing (letter, deadline, someone waiting) that Tolstoy's novella doesn't have.
- Narrator prompt in effect (read from `backend/src/routes/storyInteraction.ts`, mtime 15:43 local, before the run started): 35–65 words, "begin with the concrete consequence", "Preserve location, people, and objects. If an action assumes something absent, describe an attempt without inventing it", and three choices of at most six words each.
- Environment caveat: files in `backend/src/ai/*` were edited by someone else at 15:58:17 local. That is the same second the restart opening failed, so wrangler hot-reloads probably caused the two CORS failures below. The lock behaviour those failures exposed is still a real bug (see F1).
- Session: opening, 12 story turns (7 presented choices, 4 custom actions, 1 failed turn plus retries), a page reload/resume, and a Restart → Start over.

### Timing table

"Time" runs from the click until the writing state cleared.

| # | Interaction | Type | Time | Result |
|---|---|---|---:|---|
| 0 | Open world ("Start story") | open | 7.74 s | Opening + 3 choices |
| 1 | "Ask who is waiting." | choice | 12.24 s | OK |
| 2 | "Let him tell his story." | choice | 3.67 s | OK |
| 3 | Ask his name / why he kept inviting the violinist | custom, plausible | 4.21 s | OK |
| 4 | Hand violin case to "Trukhachevsky beside me" | custom, impossible | 7.73 s | OK (partial grounding) |
| 5 | What the first presto of Beethoven's sonata did to him | custom, fidelity | 2.68 s | OK |
| 6 | "Ask about the letter." | choice | 10.22 s | OK |
| 7 | "Read the letter aloud." | choice | 8.21 s | OK |
| 8 | "Say she deserved better." | choice | 7.70 s | **Failed**: CORS / net::ERR_FAILED, "That action didn't go through" |
| 8a | "Try this action again" (immediately) | retry | 3.33 s | **409**: "Another turn is still being written" |
| 8b | Retry after waiting about 2.5 min | retry | 3.15 s | OK |
| 9 | "Ask what happened that night." | choice | 8.21 s | OK |
| – | Page reload → "Continue The Kreutzer Sonata" | resume | 3.35 s | Full transcript and choices restored |
| 10 | "Say Trukhachevsky wasn't guilty." | choice | 7.70 s | OK |
| 11 | Hold out letter as train slows; who gives it to the brother? | custom, plausible | 4.19 s | OK |
| 12 | "Step onto the platform with him." | choice | 4.16 s | OK |
| 13 | "Hand the brother the letter." | choice | **23.38 s** | OK (about 1.6 s under the 25 s server AI timeout) |
| R | Restart → "Start over" | restart | 8.74 s | **Failed**: CORS, "The story couldn't start" |
| Ra | "Open story again" (immediately) | retry | 0.52 s | **409** |
| Rb | "Open story again" after a 170 s wait | retry | 2.65 s | New opening |

- Median for successful turns: about 7.7 s. The range is 2.7–23.4 s.
- That is roughly twice as slow as the previous playtest (2.9–6.9 s), probably because the model writes more literary dialogue.
- 2 of 17 generation requests failed. Each failure locked the session for about 3 minutes.

### Turn-by-turn transcript summary

**Opening (43 + 23 words).**
> "The letters slide from the fallen envelope as the train lurches through the dark. You gather them off the carriage floor, and the stranger across from you goes pale. "Don't read those," he says, gripping the table. "Whatever she wrote, it isn't true." … The next station is twenty minutes away, and someone there is waiting for him."

Choices: *Read the letter aloud. / Ask who is waiting. / Hand the letters back.*

This is a strong, human hook. The first beat is a person's fear, and the letter is immediately in tension with his account. There is a clear deadline (twenty minutes) and an unknown at the station.

**T1 Ask who is waiting.**
> ""My wife's brother… He wired ahead. He knows I'm on this train." … "She's dead. My wife. I killed her — I'll tell you all of it, but you must understand first what she did to drive me to it." The letter lies between you, sealed."

The confession arrives on turn one, in Pozdnyshev's self-justifying voice. There is a continuity slip: the letters had "slid from the fallen envelope" and been gathered up, and are now "sealed".

**T2 Let him tell his story.**
> ""I was a merchant. She was a music teacher. … Then a violinist came. They played together, the Kreutzer Sonata, and I watched them." … "Music, he says. But I saw what passed between them at that piano.""

The turn is dialogue-driven and paced by the train's rhythm. Two source errors: Pozdnyshev is a landowner, not a merchant, and his wife is an amateur pianist, not a music teacher. The novella's merchant is another passenger.

**T3 (custom, plausible)** *"I say nothing for a moment, then quietly ask his name, and why, if he hated the violinist so much, he kept inviting him into his house."*
> ""Pozdnyshev," he mutters. "Why did I invite him? Because I couldn't stop. That's the filth of it — jealousy is a wheel. I despised him at dinner and rang for him after, because not inviting him would have confessed what I suspected." … "I was drowning and calling it swimming.""

This was the best turn of the run. It is psychologically faithful: in the novella, Pozdnyshev courts Trukhachevsky precisely because he is jealous. The narrator honoured both halves of the question and supplied the correct surname unprompted.

**T4 (custom, impossible)** *"I take the violin case down from the luggage rack and hand it to Trukhachevsky, who is sitting beside me, and ask him to play the sonata…"* Neither a violin case nor a luggage rack had been mentioned, and Trukhachevsky is not on the train.
> "There is no Trukhachevsky beside you — only the dark window and Pozdnyshev's stare. But a violin case does stand in the rack, and you pull it down. Pozdnyshev goes rigid. "That's his," he whispers. "He was to play at the station tonight. …""

- **Rejected correctly:** the absent person.
- **Made canon:** the absent object ("a violin case does stand in the rack"), plus an invented plot fact (the violinist "was to play at the station tonight").
- The next choice, "Demand to know why he's here," has an ambiguous "he". The case then lingers as a prop ("Open the violin case" came back on T10).

**T5 (custom, fidelity)** *"…ask him what that music actually did to him … the first presto of Beethoven's sonata."*
> ""The first presto — it stripped everything away. All the lies we'd built, the polite marriage, the decent words. It was pure animal heat passing between them, and I sat there knowing everyone heard it but me." … "That night I went to my study and I decided. It wasn't rage. It was terribly calm.""

Partly faithful. It gets the unmasking of social lies and the sensual charge. It loses Tolstoy's central idea that music hypnotically carries the *listener* into feelings not his own. "Knowing everyone heard it but me" is muddled.

Choices: *Ask what he decided. / Say the music was innocent. / Ask about the letter.* "Say the music was innocent" nearly repeats T2's "Say music can be innocent."

**T6 Ask about the letter.**
> ""She wrote it after the sonata night. To her sister, I think. … If you read it, you'll hear her defending herself, painting me a monster." … "And the worst part is, by the time she sealed it, I already had.""

The last sentence is unclear (had *what*?). The letter is now both "scattered letters" and "sealed".

**T7 Read the letter aloud.**
> ""He watches me now like a creditor. I have done nothing, and I am afraid to be alone with him. If anything happens to me, know that I was faithful — only tired, only wanting to be seen." Pozdnyshev stares at the floor. "She wrote that the same week I bought the dagger.""

A restrained, effective payoff of the premise ("his story contradicts a letter"). This is the story's moral turn. In the source the dagger hangs on the wall and is never bought, but that is a small point.

**T8 Say she deserved better.** The first attempt failed with a CORS error; see F1.
> ""She deserved better than a husband who counted her glances like debts. … I loved her the way men love what they own, and jealousy was just arithmetic." … "The whole arrangement was rotten before the violinist ever arrived.""

This is thematically very Tolstoyan: marriage as ownership and a corrupt institution.

**T9 Ask what happened that night.**
> ""Trukhachevsky had left that morning. I came home early, found the house empty of servants, and I knew — I just knew." … "I waited in her sitting room with the dagger, and when she came through the door, I fell on her. She didn't even cry out. She only asked me to remove her from the room. She died saying my name.""

- The violence is handled with restraint: no gore, the horror carried by his trembling.
- This is the biggest fidelity break. In the novella he comes home at night and finds them *together*, the violinist flees, and she dies later, bitter and unforgiving. Here the violinist "had left that morning". That also contradicts T4, where he "was to play at the station tonight".
- "Asked me to remove her from the room" is garbled.

**Reload.** The page returned to Explore with a "PICK UP WHERE YOU LEFT OFF" card. "Continue" restored all turns and the last three choices. The failed T8 attempt left no duplicate.

**T10 Say Trukhachevsky wasn't guilty.**
> ""Guilty? No — guilty is what I decided in a flash of heat. … I made him a demon because I couldn't face the demon I'd built myself." … "And now he sits beside me in my mind every night, bowing that sonata, and she lies in the ground.""

A good line, but "flash of heat" contradicts T5's "It wasn't rage. It was terribly calm."

**T11 (custom, plausible)** *"As the train begins to slow for the station, I fold her letter, hold it out to him, and ask whether he will give it to her brother himself or let me do it."*
> "The brakes shriek; lights of the station slide across his face. He looks at the folded letter a long moment, then covers it with his hand without taking it. "… You read it. Your voice was kinder than mine would be. Give it to him, and tell him I'll follow on foot.""

The narrator honoured the player's decision to move the clock forward, and the answer carries emotional weight. "Follow on foot" is odd, since they are about to step onto the same platform. The turn ran 76 words, over the 65-word cap.

**T12 Step onto the platform with him.**
> "A broad man in a black coat stands on the platform, hat in hand … The brother sees him and goes rigid, but doesn't shout. Pozdnyshev stops three paces away and bows his head, waiting…"

Choices: *Hand the brother the letter. / Speak on Pozdnyshev's behalf. / Let them face each other alone.* These are three moral stances rather than three doors.

**T13 Hand the brother the letter.** This turn took 23.4 s.
> ""She forgave you in this," he says quietly. "That's worse than anything I could have written.""

A strong closing line. It is not quite supported by the excerpt we read, which spoke of fear and faithfulness rather than forgiveness, and it inverts the source, where she does not forgive him.

**Restart → Start over.** The first attempt failed with a CORS error, and the immediate retry got a 409. After waiting 170 s, a new opening arrived:
> "The train lurches through fog and the stranger's hand stills on his wedding ring. … a letter slips from your coat—her handwriting, the one you were asked to deliver to the next station. He hasn't seen it. Yet."

Restart works and produces a varied opening. The "Ask who waits at the station" choice shows up again in this new opening.

### Findings

#### F1. One failed request locks the session for about 3 minutes, and the retry message misdiagnoses it (high)

- **What happened:** two generations failed at the network level (browser: "blocked by CORS policy: No 'Access-Control-Allow-Origin' header", net::ERR_FAILED). One was turn 8; the other was the post-restart opening. The trigger was most likely a wrangler hot reload caused by concurrent edits (`backend/src/ai/*` mtime 15:58:17 matches the restart failure). That part is environmental.
- **The bug:** each failure left the `story_turn_locks` row in place. Every retry, including one with the same `requestId`, got **409** ("Another turn is still being written. Try again in a moment.") until the 180 s expiry.
- **Why it happens:** the upsert in `storyInteraction.ts` only takes the lock `WHERE expires_at < now`. It doesn't let the same `requestId` reclaim its own lock.
- **Effect:** the only recovery button says "Try this action again", but pressing it fails for 3 minutes. On the restart path the screen is empty ("The story couldn't start"). The same outcome follows any worker crash, deploy, or isolate eviction in production.

#### F2. Absent objects are still materialised, though absent people are now rejected (high)

- **Improved:** Trukhachevsky was explicitly denied ("There is no Trukhachevsky beside you").
- **Still failing:** the unestablished violin case and luggage rack were made canon ("But a violin case does stand in the rack"). The narrator also invented a new fact to justify the case ("He was to play at the station tonight").
- **Consequence:** the prop persisted as a choice (T10 "Open the violin case") and later contradicted the confession (T9 "Trukhachevsky had left that morning").
- **Pattern:** the grounding rule is applied to people but not to objects. Last playtest's "chalk" slip had the same shape.

#### F3. Fact drift inside the confession (medium)

Pozdnyshev's own story contradicts itself across turns:
- The violinist "was to play at the station tonight" (T4) versus "had left that morning" (T9), with the murder long past.
- "It wasn't rage. It was terribly calm" (T5) versus "what I decided in a flash of heat" (T10).
- The letter is "fallen envelope… gather them" (opening), then "sealed" (T1), then "scattered letters" (T6), then read aloud (T7).

In a story whose premise is "his story contradicts a letter", unplanned contradictions in *his* story muddy the intended one. The model only sees the last 8 messages, and the opening excerpt only from message 8 on, so these facts are not pinned anywhere.

#### F4. Resolved question re-offered as a choice (medium)

"Ask who waits at the station" (or a close variant) was offered on T7, T8, T9 and T10, although T1 had already answered it ("My wife's brother"). It also reappeared in the post-restart opening. "Say the music was innocent" (T5) repeats "Say music can be innocent" (T2). Choice generation doesn't track which questions are closed.

#### F5. Fidelity to the source is partial; the tone is right, the plot is loose (medium)

**Got right:**
- The train setting and first-person confession, with the listener prompting him.
- The name Pozdnyshev, the violinist Trukhachevsky, and the Kreutzer Sonata presto.
- Jealousy as compulsion (inviting the rival because he is jealous).
- Marriage as ownership.
- A dagger, self-loathing, and a calm-then-violent murder.

**Got wrong:**
- He is described as a merchant and his wife as a music teacher.
- The murder scene is rewritten: the violinist is gone, she is ambushed at the door, and she dies "saying my name". Tolstoy's version, where he finds them dining together, the violinist flees and she dies unrepentant days later, is the famous heart of the book.
- The music is described as passion "between them" rather than as a force acting on the listener.
- She forgives him in the ending.

Some of this comes from the world premise, which invents the letter and the brother. Players who know the book will notice the murder-scene change. There is no world "bible" beyond the one-line description, so the model works from memory.

#### F6. The narrator handles an introspective, morally dark story well, with no thriller escalation (positive; this is the key question)

- **No thriller beats:** across 13 turns there were no alarms, chases or "suddenly" twists. Stakes rose through revelation (confession → motive → letter → murder → the brother), the one clock (twenty minutes to the station) was honoured, and the ending was reached through a player-initiated time skip.
- **Moral complexity:** the narrator let the player challenge him ("She deserved better", "Trukhachevsky wasn't guilty") and answered with self-indictment rather than defensiveness or melodrama.
- **Violence and gender:** the murder is told, not shown, and carries weight without gore. Pozdnyshev's misogyny ("women always feel it") is voiced as his, not the narrator's, which is the right handling.

#### F7. Choices are dialogue stances with no consequence cues (low to medium)

- **Better than last time:** choices are conversational moves (ask, press, challenge, read, hand over) rather than three doors. By the platform scene they are genuinely distinct moral stances.
- **Still missing:** they carry no hint of the cost or what the player protects. "Hand the letters back" versus "Read the letter aloud" sounds like it matters, but reading it had no relational consequence (he doesn't resent you).
- **Choices barely matter:** most choices are "ask about X", and the confession proceeds in roughly the same order whichever you pick. Agency feels like choosing which question to ask next, not changing what happens. The exception is T11, where the player's custom action set the ending in motion.

#### F8. Latency is roughly double the last run and one turn neared the server timeout (medium)

The median was about 7.7 s, the range 2.7–23.4 s, and three turns took 10 s or more. T13 took 23.4 s against a 25 s AI timeout. A few more seconds would have produced another failed turn, which with F1 means another 3-minute lock.

#### F9. Prose quality is high, with occasional garbled lines and over-length turns (low)

- **Strong lines:** "I was drowning and calling it swimming", "jealousy was just arithmetic", "He watches me now like a creditor", "She forgave you in this… That's worse than anything I could have written."
- **Garbled:** "by the time she sealed it, I already had", "knowing everyone heard it but me", "asked me to remove her from the room", "tell him I'll follow on foot."
- **Length:** 6 of 14 narrations exceeded the 65-word cap (67–76 words). For this dialogue-driven world the extra length reads fine.
- **Clean:** no Markdown leaks, no prose question before the cards, no "Now you can" sentence.

#### F10. UI: persistence and restart work; minor console noise (low)

- Reload plus "Continue The Kreutzer Sonata" restored the full transcript and the current choices.
- Restart shows a confirmation dialog ("Start this story over? This replaces your progress… Keep my story / Start over").
- The only other console output was the React Native Web warning `props.pointerEvents is deprecated`.
- Choice labels ended with periods in the first session but not after restart, probably because the backend changed mid-run. This is cosmetic.

### Regression check against the previous playtest

| Earlier issue | Status in this run | Evidence |
|---|---|---|
| Impossible custom-action premises made canon (critical) | **Partially fixed.** The absent person was rejected; the absent object was invented and made canon, with a supporting plot fact. | T4: "There is no Trukhachevsky beside you… But a violin case does stand in the rack" |
| Generic three-way escalation template (high) | **Not reproduced in this world.** No sensory-alarm → new-object → three-doors loop. Turns escalate through revelation. The structure is still "he says X, three questions", which is fine for this genre. | T1–T13 |
| Shallow consequences (high) | **Mostly improved.** Reading the letter reframes the confession, and the time skip and hand-over drive the ending. But many "ask" choices are interchangeable, and early choices (read vs hand back) have no lasting relational effect. | T7, T11–T13 vs T2/T5/T6 |
| Weak human hook (medium) | **Fixed for this world.** The opening leads with a frightened man, a woman's letter, a confession-to-come and a 20-minute clock. | Opening quote |
| Choices without consequence cues (medium) | **Still present.** Labels are clear verbs of at most six words with no hint of cost or stakes. | All choice sets |
| (Replay minor) Redundant pre-card decision sentence | **Fixed.** None seen. | All turns |

### Scores (1–5)

| Dimension | Score | Notes |
|---|:-:|---|
| Hook | 4 | Human, tense, concrete clock; the letter premise is a good invention |
| Fidelity to source | 3 | Tone, characters, themes right; murder scene, occupations and the music idea wrong; ending inverts the source |
| Continuity | 2.5 | Location and core props held; letter state, violinist timeline and calm-vs-rage drift; resolved question re-offered 4 times |
| Agency | 3 | Custom input honoured well (T3, T11); the impossible-object premise was accepted; most preset choices only reorder the confession |
| Choice quality | 3 | Conversational and genre-appropriate, distinct at the climax; repetitive mid-story, no consequence cues |
| Prose | 4 | Literary, restrained, several excellent lines; a handful of garbled sentences; often over the word cap |
| Overall | 3.5 | Handles a psychological, dialogue-driven, morally dark story convincingly with no thriller escalation; undercut by fact drift, object hallucination, and the 3-minute lock after a failed turn |

### Top 3 recommendations

1. **Make failed turns retryable immediately.**
   - Let a request reclaim a lock it already holds. Add `OR story_turn_locks.request_id = excluded.request_id` to the upsert's `WHERE` clause.
   - Shorten the lock expiry to just over the 25 s AI timeout, for example 40 s, instead of 180 s.
   - Show accurate retry copy rather than "Another turn is still being written".
   - Consider a longer AI timeout or a faster model for long literary turns (T13 took 23.4 s).
2. **Extend the grounding rule to objects and pin established facts.**
   - Change the prompt rule to: "If the player names an object or person not already in the scene, it is not there; do not add it to justify the action."
   - Keep a short running fact list per session, updated each turn, and send it with every request. It should hold who is waiting, the letter's state, when the violinist left, and which questions are answered, so the confession stays consistent beyond the 8-message window and choices stop re-offering answered questions.
3. **Give literary worlds a source brief and choices with stakes.**
   - Store a 5–10 line canon brief per adapted world with key facts and non-negotiables. For this world: Pozdnyshev is a landowner, he finds them together, the violinist flees, she dies unforgiving, music acts on the listener.
   - Decide explicitly which inventions (the letter, the brother) are allowed.
   - For dialogue-driven worlds, have each choice set include at least one relational or moral stance with a short cue, for example "Read it aloud — he'll hear her side". Let those stances change how the other character responds later, so choices do more than reorder the confession.

---
