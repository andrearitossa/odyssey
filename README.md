# Odyssey

Interactive stories with a short loop: choose a world, read a scene, choose what happens next. The app starts as a guest; add an optional username and password in **You** to keep the same stories across devices. Google OAuth has been removed.

## Run locally

Use Node.js 22 or newer.

```sh
cd backend
npm install
npx wrangler login
npx wrangler d1 execute odissey-db --local --file schema.sql
npm run dev
```

In a second terminal:

```sh
cd frontend
npm install
npm run web -- --port 8081
```

Open http://localhost:8081. The local API runs at http://localhost:8787. Guest identities and story data live in local D1; this does not modify production D1.

Workers AI uses your Cloudflare account even during local development. The AI binding connects remotely and uses `@cf/zai-org/glm-5.3-flash` for stories by default; no Google credentials are needed. A configured external AI provider can be used as a fallback via `backend/.dev.vars` (see its example file). Never put API secrets in frontend environment variables.

Set `EXPO_PUBLIC_API_URL` to explicitly select another API. The new guest/account flow requires the matching backend version and schema; it is not compatible with the old Google-only deployment.

## Interaction

- Explore a world or create one from a title and optional description.
- Read the scene, select one of the current choices, or write a custom action.
- On web, Enter sends and Shift+Enter adds a line.
- Failed requests preserve the action for retry. Duplicate submissions are blocked.
- Resume from Explore. Restart asks before replacing the current adventure.
- Guest progress stays linked to this browser. Adding an account preserves it; signing in on another device restores the account's stories.
- New worlds are private to their creator. Legacy shared worlds remain discoverable.

## Checks

```sh
cd backend
npm run build

cd ../frontend
npm run typecheck
npm run build:web
npx playwright install chromium
npm run test:ui
```

Browser regression tests use controlled API responses. They cover the user flow independently of model availability. Real Cloudflare service checks are documented in `docs/cloudflare-audit.md`.

With the local backend running, `cd backend && npm run test:smoke` checks accounts, privacy, and request limits against local D1. Set `LIVE_AI=1` to include real generation, saved-response replay, and concurrent-turn checks; this consumes Workers AI usage. The smoke test refuses non-local servers and creates private local fixtures.

## Deployment

Local changes do not deploy automatically. Apply the guest/account schema additions and deploy the backend and frontend together. Existing Google-user rows are retained for data compatibility, but Google sign-in is removed from this version. Password reset and automatic migration from a Google identity to a password account are not implemented.

For an existing local database, the additive migration is:

```sh
cd backend
npx wrangler d1 execute odissey-db --local --file migrations/0001_guest_accounts.sql
npx wrangler d1 execute odissey-db --local --file migrations/0002_compact_premises.sql
```

The matching migration must be applied to the deployment database before deploying these routes. Review a backup and migration plan before switching an existing public app away from Google identities.

## Review evidence

- [Delivery status](docs/delivery-status.md)
- [Cloudflare service audit](docs/cloudflare-audit.md)
- [Real story playtest](docs/story-playtest.md)
- [Short-form research](docs/short-form-research.md)
- [Experience decisions](docs/experience-decisions.md)
