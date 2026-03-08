# Cooperative Poker (AppDeploy)

Conference icebreaker: admin creates events and manages rounds; participants enter with an event code, set a profile, join the round when it's active, and receive a hand of four cards from a shared deck. Deployed via the AppDeploy MCP server.

- **Live URL:** https://9fa3fb53f2ea4bc3b5.v2.appdeploy.ai/
- **App ID:** `9fa3fb53f2ea4bc3b5`

Built as part of the **AI Israel Club × AppDeploy: Hackathon #1 2026**.

---

## Stack

- **Frontend:** Next.js (static export), `@appdeploy/client` for API calls
- **Backend:** Lambda-style handler in `backend/index.ts`; persistence via `@appdeploy/sdk` `db` on deploy, Prisma (SQLite) locally
- **Auth:** PIN-based admin login (cookie + Bearer); attendees use `event_code` + `device_session_token` / `player_id` in sessionStorage
- **Images:** Hosted via jsDelivr CDN (`https://cdn.jsdelivr.net/gh/levyavi/combo_poker@main/cooperative-poker/public/`)

---

## Features

**Admin**
- Create event (event code 5–10 alphanumeric, admin PIN)
- Admin login gated by PIN; session token stored in sessionStorage
- Round lifecycle: NOT_STARTED → ACTIVE (start round) → ENDED (end round)
- Edit event: title, description, OpenAI API key, combo pair cooldown, LLM instructions, hand scores per hand rank
- Delete event

**Attendees**
- Enter event with event code → create/load player, redirect to event home
- First-time players land on `/profile?new=1` — name is required before continuing; bottom nav and cancel are hidden
- Edit profile (display name, workplace, title, interests, email, phone, website URL); all fields may be shared with interaction partners
- Join round when state is ACTIVE → receive 4 cards from the event deck
- View hand; hand and profile persist across refresh (session uses `player_id` when available)

**Combo + leaderboard**
- Create invite (5-digit code) or join with code; leader selects 5 cards from combined 8, submits; both players get the hand score
- Cooldown: same pair cannot re-match within the configured cooldown period (default 5 minutes)
- Cannot submit the same 5-card hand with the same partner twice
- Leaderboard: ranked by total score, filterable by Top 10 / Around Me / All; ties broken by first submission time

**Icebreak + interactions + post-round**
- **Icebreak:** After create/join combo, attendee sees a break-the-ice question generated via OpenAI using both player profiles and admin LLM instructions. Leader sees a placeholder until partner joins.
- **LLM instructions** support `{{asking}}` and `{{asked}}` placeholders (replaced with JSON player profiles at runtime).
- **Interactions:** Lists a player's combos; each entry links to a contact detail view showing partner info (visible after submission or when round ends).
- **Post-round:** When round state is ENDED, combo write endpoints return 400; leaderboard is read-only.

---

## UI Design System

All screens share a consistent design language:

- **Header:** Blue gradient bar (`#2563eb → #3b82f6`) with "Cooperative Poker" title
- **Background:** `#f8fafc`
- **Cards:** White, `border-radius: 16px`, `box-shadow: 0 10px 24px rgba(15,23,42,0.08)`, `padding: 22px`
- **Primary button:** Blue gradient, `border-radius: 12px`, `box-shadow: 0 6px 14px rgba(37,99,235,0.35)`
- **Bottom nav:** Fixed, 64px, SVG icons, active tab highlighted blue with 2px top indicator
- **Playing cards:** SVG images from the [svg-playing-cards](https://github.com/MattCain/svg-playing-cards) project by Matt Cain (MIT), served via jsDelivr CDN
- **Favicon:** SVG + PNG, blue gradient circle with white spade

---

## Run locally

**What you need**

- Node.js (v18+)
- No AppDeploy account or MCP; the app uses a local API server and local DB.

**Steps**

1. **Install and prepare the DB**
   ```bash
   npm install
   ```
   Create a `.env` file in the project root with:
   ```
   DATABASE_URL="file:./dev.db"
   ```
   Then run migrations:
   ```bash
   npx prisma migrate deploy
   ```

2. **Start the backend** (leave this running in one terminal)
   ```bash
   npm run api
   ```
   Backend runs at http://localhost:3001 (or set `API_PORT` to use another port).

3. **Configure the frontend to use the local API**
   Create `.env.local` in the project root (see `.env.local.example`):
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

4. **Start the frontend** (in a second terminal)
   ```bash
   npm run dev
   ```
   Open http://localhost:3000. The app will call the local backend; admin and attendee flows work as on the live site.

**Note:** `npm run build` can fail locally because `@appdeploy/client` is not installed; the platform provides it only at deploy time.

---

## Run with AppDeploy

**What you need**

- Access to the AppDeploy MCP server (e.g. in Cursor with the AppDeploy integration).
- The app is already deployed; App ID: `9fa3fb53f2ea4bc3b5`.

**How it works**

- **Frontend:** Static Next.js export is served by the platform. The frontend uses `@appdeploy/client` for API calls (provided at deploy time), so no `NEXT_PUBLIC_API_URL` is needed.
- **Backend:** The platform runs `backend/index.ts` as a serverless handler. Persistence uses `@appdeploy/sdk` `db` (no local Prisma).
- **Deploying changes:** Use the AppDeploy MCP `deploy_app` action with `app_id: "9fa3fb53f2ea4bc3b5"` and `files` or `diffs`. Diffs must match the **currently deployed** file content (use `src_read` if validation fails). See `.cursor/rules/appdeploy.mdc` for platform constraints, auth, CORS, and profile/player identity rules.

**Live URL:** https://9fa3fb53f2ea4bc3b5.v2.appdeploy.ai/

---

## Tests

```bash
npm test
```

Runs Prisma migrate then Vitest; uses `file:./test.db` via `cross-env`. Backend uses the Prisma adapter when `@appdeploy/sdk` is not available (local/Vitest). Covers event/round lifecycle, deck dealing, create_or_load, profile update, hand persistence, combo lifecycle and cooldown, and icebreak question, interactions, contact, post-round create_invite blocked.

---

## Key files

**Frontend pages**
- `pages/index.tsx` – Welcome screen with hero image, event code entry, create_or_load, redirect to `/home` or `/profile?new=1`
- `pages/about.tsx` – About page with app description and open source attribution
- `pages/home.tsx` – Event home: round status, join round, player hand preview, leaderboard preview, combo actions
- `pages/profile.tsx` – Attendee profile form; first-time flow (`?new=1`) requires name before continuing
- `pages/instructions.tsx` – How to play, scoring table, tips
- `pages/create-combo.tsx` – Create combo invite with QR code and invite code
- `pages/join-combo.tsx` – Join combo by entering invite code
- `pages/icebreak.tsx` – Break-the-ice question; polls until partner joins (leader)
- `pages/combo.tsx` – Card grid/list view, select 5 cards (leader), submit combo
- `pages/combo-scoring.tsx` – Scoring reference showing hand scores for the event
- `pages/score.tsx` – Post-combo score breakdown (points earned + new total)
- `pages/leaderboard.tsx` – Full leaderboard with Top 10 / Around Me / All filter
- `pages/interactions.tsx` – List of player's past combos with partners
- `pages/contact/[id].tsx` – Combo detail and partner contact info (visible after submission or round end)
- `pages/admin.tsx` – Admin UI: PIN gate, event list, create event, edit event, delete event
- `pages/_app.tsx` – Global head with favicon links (jsDelivr CDN)

**Backend**
- `backend/index.ts` – API routes, CORS, db abstraction; event/player/deck/combo logic, `findEventByCode`, `resolvePlayer`; GET /api/icebreak/question, GET /api/interactions and /api/interactions/:id; post-round enforcement
- `backend/types.ts` – Shared types and constants including `DEFAULT_LLM_INSTRUCTIONS` (uses `{{asking}}` / `{{asked}}` placeholders)
- `backend/icebreaker.ts` – LLM prompt construction and OpenAI call; replaces `{{asking}}` and `{{asked}}` with JSON player profiles

**Other**
- `scripts/local-api-server.ts` – Local API server; forwards query params and path+query in `rawPath`
- `docs/prompts.md` – Feature prompts
- `docs/conference-icebreaker-poker-spec-v1.md` – API shapes
- `.cursor/rules/appdeploy.mdc` – AppDeploy rules and lessons learned
