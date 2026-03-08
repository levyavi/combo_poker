# Cooperative Poker – Hackathon Blueprint

Spec reference: Cooperative Poker (AppDeploy) – v1 :contentReference[oaicite:2]{index=2}  
Prompting constraints: AppDeploy Prompting Guidelines :contentReference[oaicite:3]{index=3}

This blueprint defines a 5-step, incrementally testable implementation plan using AppDeploy (frontend+backend, nextjs-static template). Each step is:

- Vertically integrated (DB + backend + UI)
- Manually testable
- Safe to implement with strong testing
- Presentable as a milestone
- Fully wired (no orphaned logic)

The backend is authoritative for all game logic.

---

# High-Level Architecture

App type: frontend+backend  
Template: nextjs-static  

Key stack:

- Next.js frontend (mobile-first Tailwind)
- backend/index.ts router (authoritative game logic)
- Prisma + SQLite
- Vitest for backend tests

Core principles:

1. All stateful logic lives in backend/index.ts.
2. Frontend uses api from @appdeploy/client.
3. No Next.js API routes.
4. No client-side scoring or deck logic.

---

# Step 1 – Event + Admin + Round State Foundation

## Goal

Create the event model, admin authentication (PIN-based), and round state machine (NOT_STARTED, ACTIVE, ENDED). No players or gameplay yet.

## Scope

Backend:
- Event model (Prisma)
- Admin session (secure cookie)
- Admin login
- Create event
- Get event
- Start round
- End round

Frontend:
- Admin page:
  - Create event form
  - Login form
  - Dashboard
  - Start / End round controls

No attendee UI yet.

## Manual Test

1. Create event with unique code.
2. Login with correct PIN.
3. Start round.
4. End round.
5. Refresh and confirm state persists.

Presentable milestone:
- Organizer can configure and control a live round lifecycle.

---

# Step 2 – Attendee Entry + Profile + Join Round + Deck + Hand

## Goal

Allow attendees to:
- Enter event
- Create profile
- Join round
- Receive 4 cards from authoritative global deck

## Scope

Backend:

Models:
- Player
- Deck (global per event)

Logic:
- POST /event/enter
- POST /player/create_or_load
- PUT /player/profile
- POST /round/join
- GET /player/hand

Deck:
- 52 cards
- When empty, open new deck
- 4 cards dealt on Join Round
- Hand stored on Player

Frontend:
- Event Code Entry page
- Profile page
- Home page
- My Hand screen

Manual Test:

1. Admin starts round.
2. Attendee enters event.
3. Create profile.
4. Press Join Round.
5. See 4 cards.
6. Open multiple browsers and verify cards are unique until deck resets.

Presentable milestone:
- Live deck and hands, fully authoritative.

---

# Step 3 – Combo Lifecycle (Without LLM)

## Goal

Implement the full combo session lifecycle without break-the-ice LLM question.

Includes:
- Invite creation
- Join via 5-digit code
- 8-card shared view
- Leader selection
- Auto-fill to 5 cards
- Poker evaluation
- Scoring
- Leaderboard
- Cooldown enforcement

## Scope

Backend:

Models:
- ComboSession
- InteractionEdge

Logic:
- POST /combo/create_invite
- POST /combo/join
- POST /combo/select
- POST /combo/submit
- POST /combo/leave
- GET /leaderboard

Features:
- Single-use 5-digit invite
- Leader-only selection
- Auto-complete to 5 cards
- Standard poker scoring (A2345 straight allowed)
- Exponential point table
- Score awarded to both players
- 5-minute pair cooldown
- Tie-breaker by first reach timestamp

Frontend:
- Create Combo screen (QR placeholder optional)
- Join Combo screen
- Combo Screen
- Score Screen
- Leaderboard screen

Manual Test:

1. Two players join round.
2. Player A creates invite.
3. Player B joins.
4. Leader selects fewer than 5 cards.
5. Auto-fill preview shows.
6. Submit.
7. Both receive score.
8. Leaderboard updates.
9. Attempt immediate second combo between same pair fails.

Presentable milestone:
- Full gameplay loop without LLM question.

---

# Step 4 – Break-the-Ice LLM + Interaction History + Contact View

## Goal

Add:

1. LLM-generated break-the-ice question
2. Interaction tracking
3. Post-round read-only mode
4. Contact view with combo history

## Scope

Backend:

Add:
- LLM integration endpoint
- POST /combo/next_from_icebreak
- GET /interactions
- GET /interactions/{id}
- Round state enforcement for read-only

LLM rules:
- One question
- 1–2 sentences
- No photo usage
- Uses latest profile data
- Append organizer LLM instructions

Frontend:
- Break-the-Ice screen
- Interaction List
- Contact screen
- Post-round mode

Manual Test:

1. Create combo.
2. Confirm question appears.
3. Press Next.
4. Submit combo.
5. View contact immediately after.
6. End round.
7. Confirm read-only mode.
8. View interactions and combo history.

Presentable milestone:
- Social and networking layer complete.

---

# Step 5 – Edge Cases, Robustness, Analytics, Testing Hardening

## Goal

Harden system for hackathon demo quality.

Add:

1. Disconnect grace (30 seconds)
2. Invite cancellation on leader exit
3. Offline invitee submission acceptance
4. Basic analytics endpoints
5. Admin analytics UI
6. Rate limiting for invite guesses
7. Full backend tests (deck, scoring, cooldown, tie-breaker)

Manual Test:

1. Force-close one browser mid-combo.
2. Wait 30 seconds.
3. Confirm combo cancels.
4. Submit while invitee offline.
5. Confirm score still awarded.
6. Admin views analytics.

Presentable milestone:
- Production-grade hackathon demo.

---

# Final Step Validation

Each step:

- Adds vertical value.
- Is independently testable.
- Leaves no unintegrated logic.
- Builds directly on previous schema and routes.
- Keeps backend authoritative.