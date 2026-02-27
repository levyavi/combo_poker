# Conference Icebreaker (AppDeploy)

Admin creates events and manages rounds; participants join with an event code. Deployed via the AppDeploy MCP server.

- **Live URL:** https://db81f28b786d44599d.v2.appdeploy.ai/
- **App ID:** `db81f28b786d44599d`

## Stack

- **Frontend:** Next.js (static export), `@appdeploy/client` for API calls
- **Backend:** Lambda-style handler in `backend/index.ts`; persistence via `@appdeploy/sdk` `db` on deploy, Prisma (SQLite) locally
- **Auth:** PIN-based admin login; session via HttpOnly cookie + Bearer token in `Authorization` header (for cross-origin)

## Features (Prompt 1)

- Create event (event code 5–10 alphanumeric, admin PIN, duration)
- Admin login with event code + PIN
- Round lifecycle: NOT_STARTED → ACTIVE (start round) → ENDED (end round)
- Session required for GET /api/admin/event, POST round/start, POST round/end

## Local dev

```bash
npm install
cp .env.example .env   # set DATABASE_URL if needed
npx prisma migrate deploy
npm run dev
```

## Tests

```bash
DATABASE_URL=file:./test.db npm test
```

Uses Prisma when `@appdeploy/sdk` is not available (local/Vitest).

## Deployment

Use AppDeploy MCP `deploy_app` with `app_id: "db81f28b786d44599d"` and `files`/`diffs`. See `.cursor/rules/` for deployment and platform constraints so deployments and auth work correctly.

## Key files

- `backend/index.ts` – API routes, session and CORS handling, `db` abstraction
- `pages/admin.tsx` – Admin UI, session token storage, `normalizeResponse` for API client
- `tests/tests.txt` – Test cases
- `docs/prompts.md` – Feature prompts (Prompt 1 = event + admin + round)
