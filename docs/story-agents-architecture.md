# Story engine

Each new story turn uses **one narrator inference**. There is no interpreter, critic, or automatic model repair call.

1. Authenticate and replay an already committed request if present.
2. Read versioned scene state and the last four dialogue turns. Include the world's short canon/style brief.
3. Generate one JSON response: scene, three choices, ordered proposed changes and elapsed minutes. The current Workers AI GLM provider uses JSON output mode as well as the prompt; code still validates the result.
4. Validate references, access, transfers, conditions, discoveries, goal updates and elapsed time in code. Apply changes to a copy; reject invalid output without saving or displaying it.
5. Atomically save the state/version, structured narrator message, player action and request receipt, conditional on lease ownership and the expected state version.
6. Return the approved scene and choices. The frontend displays risk cues separately from the action submitted when tapped.

New turns are buffered until validation. JSON clients receive `response` (readable text) plus `turn` (the structured scene and choices). SSE clients receive one completed event with the same fields. No unchecked JSON or partial fiction is shown. The database stores the public turn envelope in narrator message content, so resume/replay retain structured choices.

`backend/src/story/state.ts` owns the compact state, four curated initial states/style briefs, prompt and validator. `backend/src/routes/storyInteraction.ts` handles inference, transport and atomic persistence. State lives in `session_story_state` and retains important entities even after they leave recent dialogue. Facts are append-only; claims stay separate. State has bounded capacities (100 entities, 40 facts, 12 goals, 12 recent claims); old transcript messages remain saved.

Existing sessions with narration but no state row continue through the legacy text engine. New/unopened sessions use the structured engine; restart creates a new session. The frontend supports both formats. No automatic conversion of old narration into trusted state is performed.

## Local setup

Apply the additive migration before running this code against an existing database:

```sh
cd backend
./node_modules/.bin/wrangler d1 execute odissey-db --local --file migrations/0003_story_state.sql
```

The schema is also included in `backend/schema.sql` for fresh databases. Apply migration `0003_story_state.sql` to a deployment's database before deploying the backend there; this implementation does not deploy or mutate a remote database.

Validation: `npm run test:story --prefix backend`, `npm run build --prefix backend`, `npm run typecheck --prefix frontend`, and the structured/retry/resume Playwright regressions.

## Limits

Checks enforce declared state changes, not the meaning of every prose sentence. A narrator may still invent an undeclared prop or propose a narratively unearned discovery. Introductions must be explicit and cannot put new items directly into inventory, but code cannot prove that an introduction is justified. That is a deliberate limit of this one-call design. Legacy stories retain the older behavior until restarted.

JSON mode is not schema enforcement. Live tests still encountered invalid state proposals and provider failures; these reject the turn and preserve the last saved scene. There is no automatic repair inference. Bounded state also means a sufficiently long story can reach capacity and have further additions rejected; automatic compaction is not implemented.
