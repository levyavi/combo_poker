# Prompt 1 – Event + Admin + Round Lifecycle

## Goal
Implement event creation, admin login (PIN-based), admin session cookie, and round lifecycle (NOT_STARTED, ACTIVE, ENDED).

## App type and template
Use existing app (update) with app_type frontend+backend, template nextjs-static.

## Files to create/modify
- .env
- prisma/schema.prisma
- prisma/migrations/... (initial migration)
- backend/index.ts (full replacement if empty, otherwise single anchored insertion)
- pages/admin.tsx (full replacement)
- vitest.config.ts
- package.json (incremental update)

## Hard constraints
1. Frontend must not import @appdeploy/sdk.
2. Backend must not import @appdeploy/client.
3. Frontend must use api from @appdeploy/client.
4. Backend endpoints must be implemented in backend/index.ts.

## Implementation checklist

1. Add Prisma schema with Event model.
2. Add admin_session table (or store on Event).
3. Implement:
   - POST /admin/event/create
   - POST /admin/login
   - GET /admin/event
   - POST /admin/round/start
   - POST /admin/round/end
4. Store admin PIN as salted hash.
5. Issue HttpOnly cookie for session.
6. Add admin page with:
   - Create form
   - Login form
   - Dashboard

## Acceptance tests

1. Creating event with duplicate code fails.
2. Login fails with wrong PIN.
3. Start round sets state ACTIVE.
4. End round sets state ENDED.
5. Session cookie required for protected endpoints.
6. npm test exits 0.

## Preflight checklist
- Confirm frontend uses api.
- Confirm backend routes are in backend/index.ts.
- Confirm Prisma migrations exist.
- Confirm no forbidden imports.
- Confirm tests pass offline.

---

# Prompt 2 – Attendee Entry + Profile + Join Round + Deck

## Goal
Implement attendee entry, profile creation/editing, join round, global deck, and dealing 4 cards.

## App type and template
Use existing app (update) with app_type frontend+backend, template nextjs-static.

## Files to create/modify
- prisma/schema.prisma (add Player, Deck)
- new migration
- backend/index.ts (single anchored insertion after existing routes)
- pages/index.tsx (event entry)
- pages/profile.tsx
- pages/home.tsx
- pages/hand.tsx
- tests/deck.test.ts

## Hard constraints
1. Frontend must not import @appdeploy/sdk.
2. Backend must not import @appdeploy/client.
3. Frontend must use api.
4. Backend routes in backend/index.ts.

## Implementation checklist

1. Add Player model.
2. Add Deck model.
3. Implement:
   - POST /event/enter
   - POST /player/create_or_load
   - PUT /player/profile
   - POST /round/join
   - GET /player/hand
4. Implement 52-card generator.
5. On Join Round:
   - Validate round ACTIVE.
   - Deal 4 cards.
   - Persist on Player.
6. When deck empty:
   - Increment deck_index.
   - Refill.

## Acceptance tests

1. Join round before ACTIVE fails.
2. Join round during ACTIVE deals exactly 4 cards.
3. Two players do not receive duplicate cards within same deck.
4. When 52 cards exhausted, new deck opens.
5. Hand persists across refresh.
6. Tests run without network.

## Preflight checklist
- Confirm no client-side card logic.
- Confirm backend authoritative.
- Confirm migrations present.
- Confirm tests pass.

---

# Prompt 3 – Combo Lifecycle + Scoring + Leaderboard

## Goal
Implement full combo lifecycle, poker evaluation, scoring, cooldown, and leaderboard.

## App type and template
Use existing app (update) with app_type frontend+backend, template nextjs-static.

## Files to create/modify
- prisma/schema.prisma (add ComboSession, InteractionEdge)
- migration
- backend/index.ts (single insertion anchored after round routes)
- pages/create-combo.tsx
- pages/join-combo.tsx
- pages/combo.tsx
- pages/score.tsx
- pages/leaderboard.tsx
- tests/poker.test.ts
- tests/cooldown.test.ts

## Hard constraints
1. Frontend must not import @appdeploy/sdk.
2. Backend must not import @appdeploy/client.
3. Frontend must use api.
4. Backend routes in backend/index.ts.

## Implementation checklist

1. Implement 5-digit invite code generator.
2. Implement:
   - POST /combo/create_invite
   - POST /combo/join
   - POST /combo/select
   - POST /combo/submit
   - POST /combo/leave
   - GET /leaderboard
3. Enforce:
   - Leader-only selection.
   - Auto-fill remaining cards.
   - Exponential scoring table.
   - Cooldown 5 minutes per pair.
   - Tie-breaker by first reach timestamp.
4. Award full points to both players.
5. Update InteractionEdge.

## Acceptance tests

1. Invite code single-use.
2. Cannot join if already in combo.
3. Auto-fill works if fewer than 5 selected.
4. Correct scoring for:
   - One pair
   - Straight (A2345)
   - Flush
5. Cooldown prevents immediate re-match.
6. Leaderboard sorts correctly.

## Preflight checklist
- Confirm no client scoring.
- Confirm cooldown enforced server-side.
- Confirm tests cover scoring logic.
- Confirm no forbidden imports.

---

# Prompt 4 – LLM Question + Interaction History + Post-Round Mode

## Goal
Add break-the-ice LLM question, interaction list, contact view, and read-only mode after round ends.

## App type and template
Use existing app (update) with app_type frontend+backend, template nextjs-static.

## Files to create/modify
- backend/index.ts (LLM route insertion)
- pages/icebreak.tsx
- pages/interactions.tsx
- pages/contact/[id].tsx
- prisma/schema.prisma (if minor additions needed)
- tests/round_state.test.ts

## Hard constraints
1. Frontend must not import @appdeploy/sdk.
2. Backend must not import @appdeploy/client.
3. Frontend must use api.
4. Backend routes in backend/index.ts.

## Implementation checklist

1. Add LLM question generation route:
   - Uses both players’ profile data.
   - Excludes photo.
   - Appends admin LLM instructions.
   - Returns one question, 1–2 sentences.
2. Insert icebreak step before combo screen.
3. Add:
   - GET /interactions
   - GET /interactions/:id
4. Enforce:
   - After round ENDED:
     - Combo endpoints disabled.
     - Leaderboard read-only.
5. Contact info visible:
   - After submission.
   - After round.

## Acceptance tests

1. LLM route returns single question.
2. Question includes at least one profile field.
3. After round end, create_invite fails.
4. Interaction list shows both submitted and canceled combos.
5. Contact screen returns combo history.

## Preflight checklist
- Confirm no photo data passed to LLM.
- Confirm read-only mode enforced server-side.
- Confirm tests pass offline (LLM mocked if needed).

---

# Prompt 5 – Edge Cases + Grace Period + Analytics + Hardening

## Goal
Implement disconnect grace, invite cancellation, offline submission handling, analytics, and robustness tests.

## App type and template
Use existing app (update) with app_type frontend+backend, template nextjs-static.

## Files to create/modify
- backend/index.ts (single insertion anchored near combo logic)
- pages/admin.tsx (add analytics section)
- tests/grace.test.ts
- tests/analytics.test.ts

## Hard constraints
1. Frontend must not import @appdeploy/sdk.
2. Backend must not import @appdeploy/client.
3. Frontend must use api.
4. Backend routes in backend/index.ts.

## Implementation checklist

1. Add disconnect grace logic:
   - 30-second timer.
   - If not reconnected, cancel combo.
2. If leader leaves invite screen:
   - Cancel pending invite.
3. Allow submission if invitee offline.
4. Add:
   - GET /admin/analytics
   - Metrics:
     - total players
     - total combos
     - submitted
     - canceled
     - average combos per player
5. Add rate-limiting for invite guesses.
6. Add final integration tests.

## Acceptance tests

1. Disconnect beyond 30 seconds cancels combo.
2. Offline invitee still receives score on reconnect.
3. Analytics endpoint returns correct counts.
4. Invite brute-force attempts limited.
5. All tests pass.
6. npm test exits 0 without network.

## Preflight checklist
- Confirm no orphaned code.
- Confirm all new routes integrated.
- Confirm admin analytics UI calls backend via api.
- Confirm tests comprehensive.