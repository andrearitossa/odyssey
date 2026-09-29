# Cloudflare service check — 2026-09-29

The audit used read-only Cloudflare metadata, a read-only D1 query, public HTTP requests, and tiny model inference samples. No production database writes, secrets changes, or deployments were made.

| Service | Result | Evidence |
| --- | --- | --- |
| Frontend Worker | Reachable | `https://odissey-frontend.andre-ritossa.workers.dev/` returned HTTP 200 |
| Backend Worker | Reachable | `/health` returned HTTP 200 and `status: healthy` |
| Frontend → backend proxy | Broken in current deployment | `/api/health` returned HTTP 404; code forwards `/api/health` without stripping `/api` |
| D1 `odissey-db` | Accessible | Remote `SELECT 1 AS reachable` succeeded, zero writes; database has 9 tables, approximately 2.53 MB |
| Workers AI catalog | Accessible | Authenticated model catalog returned HTTP 200 |
| Text model `@cf/meta/llama-3.1-8b-instruct` | REST inference only | Returned `OK.` through REST; local binding later failed with a retired model alias, so it is not the app default |
| Text model `@cf/openai/gpt-oss-120b` | Verified inference | Returned completed assistant text `OK.` in `result.output[].content[]` |
| Text model `@cf/zai-org/glm-5.3-flash` | Verified inference and local story turns | REST returned `OK` and local browser produced complete opening and next turn; latency varied widely |
| Speech model `@cf/deepgram/aura-1` | Verified inference | Generated approximately 33 KB of audio for “Hello world.” |
| Transcription model `@cf/openai/whisper-large-v3-turbo` | Verified inference | Transcribed the generated sample as “Hello world.” |
| Gemini / Hugging Face keys | Names configured; credentials not verified | Secret names exist, but values were neither retrieved nor tested |

## Configuration drift

The deployed backend version was created on 2026-01-31. It is newer than the initial checkout and has an `AI` binding that the checkout did not declare. Its frontend has `ASSETS` and a `BACKEND` service binding. D1 is bound as `DB`.

The deployed secret is named `HUGGING_FACE_API_KEY`; the initial checkout expected `HUGGINGFACE_API_KEY`. The checkout also defaulted to `gemini-2.5-flash-lite-preview-06-17`, whose shutdown was announced for November 18, 2025 in the [Gemini release notes](https://ai.google.dev/gemini-api/docs/changelog).

The deployed GPT-OSS parser checked several response shapes but omitted the `output` array returned by the verified model request. This is a likely app-level parsing failure even though the model itself is available. The old production story endpoints require Google authentication, so a complete production user story was not exercised.

## Local fixes and limits

- The local frontend proxy now strips `/api` before forwarding to its backend binding.
- The local backend has a Workers AI provider and binding, avoiding a requirement for local Google or Gemini credentials.
- The tested local default is GPT-OSS 120B with low reasoning effort and parsing of final message output. A live browser sample produced an opening in 4.664 seconds and its next turn in 3.329 seconds; performance varies by request.
- Final provider verification preserves message roles using a Responses `input` array. Local binding inference returned HTTP 200 in 4.6 seconds. Although the [current model documentation](https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/) also shows chat `messages`, that format returned reasoning without final text in this environment; the verified Responses format is retained.
- The requested [GLM-5.3-Flash](https://developers.cloudflare.com/workers-ai/models/glm-5.3-flash/) is the new default. This model uses role-preserving chat messages and low reasoning effort. Direct REST access and local Workers AI binding were verified. In browser samples, opening latency ranged from 4.2 to 21.2 seconds and continuation from 2.9 to 14 seconds; model switching alone did not guarantee a fast turn. A 256-token budget omitted the numbered choices in one trial, so the app retains 320 tokens. Cloudflare lists this model as requiring Workers Paid or prepaid AI Gateway credits.
- The new local app uses guest sessions and optional password accounts. It must be deployed with the matching backend/schema rather than pointed at the old Google-only backend.
- Local development uses remote Workers AI inference. This consumes account usage, as documented in [Cloudflare’s Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
- Voice services were checked for availability; the simplified story interaction remains text-based.
