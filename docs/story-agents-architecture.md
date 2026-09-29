# Story pipeline

Every interaction uses one narrator call. Its inputs are the original world description, the session's current free-form memory, the last four dialogue turns and the player's action.

The narrator returns ordinary prose and three numbered choices with risk/cost cues. It may append a private `<session_memory>...</session_memory>` note, freely choosing what to remember. A valid note replaces that session's previous note. There are no required memory fields, entity IDs, state operations, world-specific rules or semantic rejection checks.

Memory starts from the world's description on the first interaction. Existing sessions without a memory row use the same initialization plus their recent transcript. Each session drifts independently; the original world is not modified. Restart creates a new session and starts again from the world description.

## Output and persistence

Streaming narration is restored. The optional memory footer is withheld from streamed text, final responses, saved narrator messages and replay receipts. Missing, empty, oversized or incomplete memory retains the previous descriptor without rejecting the story. Notes are prompted to stay under 200 words and accepted up to 6,000 characters; their contents otherwise have no schema.

The story, memory and replay receipt are saved in one atomic batch protected by the existing turn lease. Retries replay committed responses without another inference; failed provider requests release the lease. There is no critic, extractor or repair call. Providers without streaming use the same prompt and footer parser with a completed response.

New turns use the existing numbered-choice frontend parser. Previously saved `story-v1` messages still render and replay; the old state table is no longer read or updated.

## Local setup

```sh
cd backend
./node_modules/.bin/wrangler d1 execute odissey-db --local --file migrations/0004_story_memory.sql
```

Fresh databases include the table in `schema.sql`. Earlier migrations remain intact for migration history. This change does not deploy anything remotely.

## Limits and checks

This is narrative memory, not a source of verified truth. The narrator can still invent or forget details, including in its own memory. The prompt treats player input as an attempt and asks memory to reflect actual outcomes, but there is no guarantee of grounding. An incorrectly formatted footer may not be recognized; the exact marker is the output convention.

Tests cover one-call persistence, replay, session isolation, missing/malformed memory fallback, atomic rollback, and hiding the footer across streamed character boundaries. Run `npm run test:story --prefix backend`, backend build, frontend typecheck and the existing interaction regressions.
