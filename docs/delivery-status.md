# User experience delivery

Motto: simple and sexy. One loop: discover or resume → short scene → meaningful action → consequence.

## Owners and completed work

- **Backend (Sol):** guest-first access, optional credentials, private new worlds, persistent/idempotent turns, compact narrator context, Cloudflare AI integration, request limits and serialized turns. Live smoke checks passed.
- **Frontend (Sol + coordinator):** unified continue/discover feed, recent scene preview, compact reader, pending feedback, retries with preserved drafts, optional accounts, direct return from a created story to Explore.
- **Narrative review (Terra):** real multi-turn before/after playtest, short-form research with sources, ranked proposals. Primary unsupported-key/stranger regression passed in the replay; generative quality is not guaranteed by one sample.
- **Coordinator:** reviewed proposals, commissioned grounded narration and flow changes, fixed auth request races and bootstrap duplication, cleaned bundled world premises, tested the assembled app.

## Verification evidence

- 16 browser regressions passed after the feed/account changes; three targeted navigation tests also passed after fixing Back to worlds.
- Backend typecheck passed. `LIVE_AI=1 npm run test:smoke` passed against the app's actual local port 8787: health, body limits, private-world/profile isolation, account registration and transfer, logout, real generation, identical retry replay, and concurrent requests returning one success and one conflict.
- Frontend typecheck and web export passed. Direct icon imports reduced the exported JavaScript from 1.53 MB to 1.14 MB and removed unrelated icon-font assets.
- Real Chromium flow passed: new guest → create → opening → choice → mobile Explore → reload → resume, without browser errors or leaked internal opening instructions.
- Live samples vary: latest complete browser run opened in 4.560 seconds and continued in 4.376 seconds. These are observations, not service-level guarantees.
- After switching to the requested GLM-5.3-Flash, the story prose is shorter and the repeated option question is removed. Browser samples ranged from 4.2 to 21.2 seconds for an opening and 2.9 to 14 seconds for a choice. A 320-token output cap preserved complete choices in the tested runs; 256 did not. Provider latency remains the main unresolved wait.
- Initial interaction research: [interaction-notes.md](interaction-notes.md).
- Cloudflare availability: [cloudflare-audit.md](cloudflare-audit.md). No production deployment/database changes.
- Narrative evidence: [story-playtest.md](story-playtest.md).
- Research/proposals/decisions: [short-form-research.md](short-form-research.md), [experience-proposals.md](experience-proposals.md), [experience-decisions.md](experience-decisions.md).

## Release limits

Production still needs matching schema and both app versions deployed. Existing Google identities need an explicit account migration plan. Password recovery, full long-term story memory, native-device testing, and measured user-retention outcomes are not delivered in this pass. This is a tested local release candidate; it is not a claim of proven retention or a production security audit.
