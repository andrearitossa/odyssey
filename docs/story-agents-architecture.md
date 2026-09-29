# Story engine

The former planner/predictor/optimizer pipeline has been removed. Each player action now uses one narrator inference.

1. Authenticate the guest or optional account and verify ownership of the session.
2. Return the stored result if this request was already committed.
3. Read the world and bounded story context.
4. Generate a compact scene with distinct action choices.
5. Save the player action, scene, and request receipt atomically before responding.
6. Render the scene and enable the next choice or custom action.

The browser keeps a user-scoped local copy for quick return. Server history is authoritative when resuming. Failed actions retain their request identifier so retries can retrieve the committed turn without duplicating it.

The implementation lives in `backend/src/routes/storyInteraction.ts`; provider adapters live in `backend/src/ai/providers`. Interaction rationale and known limits are recorded in [interaction-notes.md](interaction-notes.md). Real service verification is in [cloudflare-audit.md](cloudflare-audit.md).
