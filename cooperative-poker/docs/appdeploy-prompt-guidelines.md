# AppDeploy Prompting Guidelines (LLM-Generated Prompts)

These guidelines are for generating reliable, low-friction prompts for AppDeploy (template-based deployments with an AppDeploy backend entrypoint).

## 1. Use the correct architecture model

1. Treat AppDeploy apps as template-based projects. You modify an existing template snapshot, you do not scaffold from scratch unless you are creating a brand-new app.
2. If you need any custom server endpoints, secrets, persistence, or auth logic, choose frontend+backend and implement server logic in backend/index.ts.
3. Do not assume Next.js API routes (pages/api/*) are available. In AppDeploy, backend HTTP endpoints should be implemented as routes in backend/index.ts (router map).
4. Frontend-to-backend calls must use api from @appdeploy/client. Do not call backend routes with fetch('/api/...') or axios('/api/...').

## 2. Always include an explicit tool-compatible spec section

When your LLM generates a prompt, it should include this structure, in this order:

1. Goal: one sentence describing the intended behavior.
2. App type and template: “Use existing app (update) with app_type frontend+backend, template nextjs-static.”
3. Files to create/modify: list the exact file paths.
4. Hard constraints:
   1. Frontend must not import @appdeploy/sdk.
   2. Backend must not import @appdeploy/client.
   3. Frontend must use api for backend calls.
   4. Backend endpoints must be implemented in backend/index.ts.
5. Acceptance tests: verifiable outcomes, ideally 3 to 10.

## 3. Write prompts that reduce diff brittleness

Diff-based updates fail most often because “from” text does not exactly match.

1. Prefer full file replacement for small files.
   1. Good candidates: pages/admin.tsx, vitest.config.ts, single-purpose helpers.
2. When you must use diffs, anchor on a unique, stable snippet.
   1. Example: insert new routes right after the exact line containing "GET /api/health".
3. Avoid multi-location diffs in the same file.
   1. Prefer one insertion per file per prompt.
4. Avoid prompts that ask the tool to refactor unrelated code while adding new behavior.

## 4. Backend route design rules for AppDeploy

1. Add routes inside the existing router map: export const handler = router({ ... }).
2. Ensure the Lambda event type includes headers if you need cookies:
   1. headers?: Record<string, string | undefined>
3. To set cookies, return a JSON response with a Set-Cookie header.
4. To read cookies, parse event.headers.cookie (and common variants like Cookie).
5. Keep route handlers small. Push logic into helper functions for readability.

## 5. Safe patterns for auth and cookies

For hackathon-style admin sessions, keep it simple and explicit:

1. Create a random session token (32 bytes or more).
2. Store only a hash of the token in the database (for example SHA-256 hex).
3. Set cookie: admin_session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
4. Validate by hashing incoming cookie token and comparing to stored hash.
5. Include an expiration timestamp and reject expired sessions.

## 6. Prisma and migrations guidelines (SQLite)

Prisma issues are common if prompts are not explicit.

1. Include .env with DATABASE_URL="file:./dev.db" for local runtime.
2. Store schema in prisma/schema.prisma.
3. For AppDeploy, ensure migrations exist on disk:
   1. prisma/migrations/migration_lock.toml
   2. At least one prisma/migrations/<timestamp>_<name>/migration.sql
4. Prefer prisma migrate deploy in scripts, not migrate dev.
5. For updates that add columns, provide explicit SQL in the migration.

## 7. Test runner guidelines (Vitest)

To avoid flakiness:

1. Keep tests Node-only (no browser requirement unless needed).
2. Call exported backend handlers directly in tests (simulate Lambda events).
3. Avoid real HTTP calls.
4. Use a dedicated SQLite file for tests (for example file:./test.db).
5. Delete the test DB before and after tests.
6. Run tests single-threaded to avoid shared process.env collisions:
   1. In vitest.config.ts, disable concurrency or force single thread.

## 8. package.json guidelines

When prompts add dependencies or scripts:

1. Never add @appdeploy/sdk or @appdeploy/client to package.json (they are platform-provided).
2. Preserve the existing build script.
3. Add scripts incrementally:
   1. postinstall: prisma generate (if Prisma is used)
   2. test: run migrations then tests (for example prisma migrate deploy && vitest run)
4. If you add TypeScript types for a dependency, add them in devDependencies.

## 9. Frontend UI guidelines for prompt clarity

1. Specify which endpoints the UI must call and when.
2. Require mobile-first Tailwind layout with minimal states:
   1. Loading
   2. Error
   3. Empty state
   4. Success state
3. For admin flows, define a simple routing strategy:
   1. On load, call “exists” endpoint.
   2. Render Create form or Login form.
   3. After success, fetch admin event details and show a summary.

## 10. A recommended prompt template for LLM generation

Use this as the system prompt or template for your prompt-generating LLM:

1. Context: You are writing an AppDeploy update prompt for an existing AppDeploy app.
2. Hard rules:
   1. Backend endpoints in backend/index.ts.
   2. Frontend uses api from @appdeploy/client for backend calls.
   3. No frontend import from @appdeploy/sdk.
   4. No backend import from @appdeploy/client.
3. Output format:
   1. Goal
   2. Implementation checklist
   3. File edits list (create vs modify)
   4. Acceptance tests
4. Diff strategy:
   1. Prefer full file replacement for small files.
   2. For large files, specify one insertion location anchored by an exact snippet.

## 11. Preflight checklist (include in every prompt)

1. Confirm app_type and template selection match the requested capabilities.
2. Confirm all backend endpoints are implemented in backend/index.ts.
3. Confirm frontend calls backend only via api.
4. Confirm no forbidden imports exist.
5. Confirm Prisma schema and migrations are present (if Prisma is used).
6. Confirm npm test exits 0 and does not depend on network.
7. Confirm acceptance tests are stated as verifiable behaviors.

## 12. Common prompt anti-patterns to avoid

1. Create a Next.js API route at pages/api/...
2. Use fetch('/api/...') to call the backend.
3. Refactor the entire codebase to match a new architecture.
4. Update package.json by replacing it entirely unless you provide a full, correct merged result.
5. Use declare global or global for singletons. Prefer globalThis.
