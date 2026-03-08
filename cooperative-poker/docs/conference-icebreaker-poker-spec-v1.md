# Cooperative Poker (AppDeploy) – v1 Specification

## 1. Summary

A mobile-friendly web app for conference attendees to play a lightweight, in-person, 2-player poker-hand combo game to break the ice. Pairing is done physically via a **single-use 5-digit code** shown as both text and QR (QR encodes the same 5 digits). The experience is organized around a **single 30-minute round** per event. A backend server is **fully authoritative** for all game logic.

Primary goal: **fun shared activity**, not matchmaking optimization.

---

## 2. Core Concepts

### 2.1 Roles
- **Attendee (Player):** joins an event using event code, creates/edits profile, joins the round, plays combos, views leaderboard and post-round interactions.
- **Organizer (Admin):** creates event, configures parameters, starts/ends round, can override/end round early, views live leaderboard, views basic post-round analytics.

### 2.2 Event Model
- **Single event** per deployment instance (codes are globally unique forever).
- Each event supports **exactly one round** (v1).
- Event access requires **Event Code** (human readable, A–Z and 0–9 only, uppercase, length 5–10).

### 2.3 Round Model
- One round per event.
- Default duration: **30 minutes**, configurable in admin panel.
- Start/end: organizer schedule + manual override (hybrid). Organizer can:
  - Start round
  - End round
  - End early/override
- Late joins allowed: attendees can press **Join Round** at any time until round ends.

### 2.4 Deck Model
- **One global 52-card deck** shared by all players for dealing initial hands.
- When the deck runs out, backend opens a new fresh 52-card deck.
- Players receive **exactly 4 cards** when they press **Join Round**.
- Player keeps those 4 cards for the entire round (cards are not consumed in v1).

---

## 3. Player Profile

### 3.1 Fields
Required:
- Display Name (string)

Optional (all shareable if provided):
- Workplace / Company name (string)
- Title (string)
- Interests (string or tag list; v1 can store as free text)
- Photo (image)
- Contact fields (all optional; shown to other player if provided):
  - Email (string)
  - Phone number (string)
  - LinkedIn URL (string)
  - Website URL (string)

### 3.2 Sharing Rules
- No per-field sharing controls in v1.
- Rule: **If a field is provided, it is shared** with other participants who interact with you.
- The app must clearly state that optional data may be shared with other participants.

### 3.3 Editing Rules
- Profile is editable at any time, including during round.
- Name changes:
  - Allowed anytime.
  - Changes apply **retroactively everywhere**: leaderboard, interaction history, combo history.
  - Name collision handling:
    - If a name duplicates another active player name, backend appends a suffix everywhere (e.g., `Avi (482)`).
    - Suffix is auto-generated, numeric, and stable for that player identity.
- Photo:
  - Capture via camera or upload from gallery.
  - **Force square (1:1) crop** before upload.
  - Visible “everywhere a player is shown” **except leaderboard**, which is ultra-compact (no photos).

### 3.4 Session / Identity
- No formal account system.
- Player identity is a server-issued **player_id** bound to the current device session.
- Multiple devices:
  - Supported via **last-write-wins** takeover.
  - New device attempting to use same player identity must confirm takeover (“This will sign out your other device. Continue?”).
  - Any device can take over later with the same confirmation flow.

> Implementation note: since v1 has no login, “same player identity” can only be established if the app issues an optional **rejoin token** stored client-side and transferable (e.g., QR export) or if “identity” is simply “same device”. If no transfer mechanism is desired in v1, interpret the takeover rule as applying only within the same device session recovery. If you want true cross-device takeover, add a “Rejoin code” feature.

---

## 4. Game Flow (Attendee)

### 4.1 Entry
1. Attendee opens app.
2. Attendee enters **Event Code**.
3. Attendee creates or edits profile.
4. Attendee can press **Join Round** once a round is active (or if the round has not started yet, UI should show “Round not started”).

### 4.2 Hand Dealing
- On **Join Round**, backend deals 4 cards from the global deck.
- Attendee sees their 4 cards.

### 4.3 Main Actions
- **Create Combo**
- **See Leaderboard**

No list of active players exists. All pairing is physical.

---

## 5. Combo Session

### 5.1 Creating a Combo (Leader)
1. Player taps **Create Combo**.
2. Backend creates a **pending combo session** and returns a **single-use 5-digit code**.
3. Leader sees a screen with:
   - QR code encoding the 5-digit code
   - The same 5-digit code as text
4. While this screen is visible, the invite is active (no separate waiting UI required).
5. Code does **not expire** until used or canceled by leaving the screen (leader navigating away cancels pending session).

### 5.2 Joining a Combo (Invitee)
1. Invitee taps **Join Combo** (or “Enter Code / Scan QR” within Create Combo flow).
2. Invitee scans QR (auto-join) or enters code.
3. If invitee is currently in another combo, joining is blocked (cannot join while in another combo).
4. If code is valid and unused, invitee joins immediately (no leader approval).

### 5.3 Break-the-Ice Question Screen
- Shown immediately to both players after join.
- Content is generated by an LLM uniquely per combo:
  - Uses both players’ profile info **except photo**.
  - Uses the latest saved profile values at time of generation.
- UI:
  - Displays question
  - Shows “Next” button
  - Soft suggestion text encouraging discussion (no enforced minimum time)
- When either player presses Next, they proceed to the combo screen (both must independently proceed; no strict synchronization required).

### 5.4 Combo Screen (8 Cards)
- Both players see:
  - Their own 4 cards labeled “My cards”
  - The other player’s 4 cards labeled “Other’s cards”
- Leader can select up to 5 cards, but:
  - If fewer than 5 are selected, system will **auto-choose** additional cards from the remaining pool to complete a 5-card hand.
  - UI must preview:
    - Which cards are auto-chosen
    - Projected hand and projected score
    - Short notification indicating auto-selection occurred
- Invitee sees the leader’s current selection and preview in real time.
- Leader presses **Submit**.

### 5.5 Submission and Scoring
- Backend validates session state, selection, and computes final 5-card hand.
- Backend awards **full points to both players** (same score).
- If invitee is offline at submit time:
  - Backend still accepts and awards points.
  - Invitee sees result upon reconnect.
- Poker rules: standard 5-card hierarchy; A2345 straight is allowed.

### 5.6 Leaving / Canceling
- Players can leave an active combo at any time.
- If someone leaves before submission:
  - Combo is canceled
  - No points awarded to either player
- No penalties or public indicators for leaving/canceling.

### 5.7 Disconnect Handling
- If one player disconnects or force-closes during an active combo (joined but not submitted):
  - Start **grace period = 30 seconds**.
  - If they reconnect in time, combo resumes.
  - If not, combo cancels with no points; remaining player is freed.

### 5.8 Cooldown Between Same Pair
- Same two players cannot form another combo until cooldown ends.
- Cooldown duration: **5 minutes** (from combo end time: submit or cancel).

---

## 6. Leaderboard

### 6.1 Scoring Model
- Total score = **sum of all combo points** during the round.
- Both players receive full points per combo.

### 6.2 Hand Point Table (Exponential)
Default v1 points:
- High card: 1
- One pair: 3
- Two pair: 8
- Three of a kind: 20
- Straight (A2345 allowed): 45
- Flush: 90
- Full house: 180
- Four of a kind: 400
- Straight flush: 900
- **Royal flush:** 1200

### 6.3 Display
Leaderboard view shows:
- Rank
- Display Name (with suffix if needed)
- Total Points
- Combos played (count)

No photos in leaderboard.

### 6.4 Jump to Me
- A “Jump to my position” button scrolls to the current user’s row.

### 6.5 Tie-breaker
If total points are equal:
1. **Earlier time reaching that score** ranks higher (first to reach the tied total).
2. If still tied, stable deterministic ordering by player_id.

---

## 7. Post-Round Experience

### 7.1 Mode After Round End
- App enters **read-only mode**:
  - Users can view final leaderboard.
  - Users can view interaction list and contact screens.
  - Users cannot start or join combos.

### 7.2 Interaction List
- Shown after round end (and also accessible after each combo, see below).
- Includes **all players they started a combo with**, even if canceled.
- For each person, show:
  - Name
  - Photo thumbnail (if available)
  - Total number of combos together (completed + canceled)
- Clicking an entry opens Contact Screen.

### 7.3 Contact Screen
Shows:
- Name, photo, workplace/company, title, interests (if provided)
- Contact info fields (email, phone, LinkedIn, website) if provided
- Combo history summary for this pair:
  - List of combos with outcome (Submitted / Canceled)
  - Hand achieved (if submitted)
  - Score (optional display; not required by decisions, but useful)

### 7.4 Visibility Timing for Contact Info
- Contact info must be visible:
  - Immediately after a successful submission (score screen includes a “View contact” action)
  - And in end-of-round recap

---

## 8. Admin Panel (Organizer)

### 8.1 Authentication
- Admin access requires:
  - Event Code
  - Admin PIN (organizer-defined during event creation)

### 8.2 Event Creation
- Organizer creates event in admin panel by setting:
  - Event Code (A–Z, 0–9; length 5–10; normalized uppercase)
  - Admin PIN (string; organizer-defined; store securely)
  - Round Duration (default 30 minutes)
  - Optional LLM instruction text (see 9.2)
- If Event Code already exists globally:
  - Reject and require a different code.

### 8.3 Round Controls
- Start round
- End round
- Override end early
- Set/adjust round duration before start (optionally also allow change mid-round; not required by decisions, but may be allowed)

### 8.4 Live View
- View live leaderboard during the round.

### 8.5 Basic Post-Round Analytics
At minimum:
- Total players who joined the round
- Total combos created
- Total combos submitted
- Total combos canceled (left/disconnect)
- Average combos per player
- Peak concurrent active combo sessions (optional but useful)

### 8.6 Event Code Management
- Admin can change the event code (per earlier choice).
  - Because codes are globally unique forever, changing code should create a new code and mark old one as retired (old code no longer valid).

---

## 9. LLM: Break-the-Ice Question

### 9.1 Generation Requirements
- Generated per combo, unique per pair each time.
- Uses both players’ profile information:
  - Name, workplace, title, interests
  - Must NOT use photo data
- Use latest saved profile data at generation time.
- No additional moderation beyond provider default (v1).

### 9.2 Organizer-Provided Instruction
Admin panel includes a free-text field: “LLM Instructions” that influences tone and style (e.g., professional, playful, short).
This instruction is appended to the system prompt for question generation.

### 9.3 Output Constraints
- Output must be a single question, 1–2 sentences.
- Avoid asking for sensitive personal data.
- Avoid referencing photos.

---

## 10. UI Screens (v1)

### 10.1 Attendee
1. Event Code Entry
2. Profile Create/Edit
3. Home (Join Round, Create Combo, Leaderboard)
4. My Hand (4 cards view, accessible from Home once joined)
5. Create Combo (QR + 5-digit code)
6. Join Combo (scan / enter code)
7. Break-the-Ice Question
8. Combo Screen (8 cards, selection + preview)
9. Score Screen (hand, points, “View contact”)
10. Leaderboard (ultra-compact + jump to me)
11. Post-round Interaction List
12. Contact Screen (profile + contact + combo history)

### 10.2 Admin
1. Admin Login (Event Code + Admin PIN)
2. Create Event
3. Admin Dashboard (duration, round state)
4. Start/End/Override controls
5. Live Leaderboard
6. Post-round Analytics
7. LLM Instructions editor
8. Event Code management

---

## 11. Backend: Authoritative Game Logic

### 11.1 Core Requirements
Backend is authoritative for:
- Round state (not started, active, ended)
- Global deck and reshuffling (new deck when empty)
- Dealing 4 cards on Join Round
- Creating/validating pending invites and single-use codes
- Combo session lifecycle
- Cooldown enforcement (pair-based 5 minutes)
- Poker evaluation and scoring
- Leaderboard totals and tie-breaking timestamps
- Interaction history and combo history

### 11.2 Data Model (Suggested)

**Event**
- event_id (uuid)
- event_code (string, unique global)
- admin_pin_hash (string)
- round_duration_seconds (int)
- llm_instructions (text)
- created_at, updated_at
- round_state: NOT_STARTED | ACTIVE | ENDED
- round_started_at, round_ends_at, round_ended_at

**Player**
- player_id (uuid)
- event_id
- display_name (string)
- display_name_suffix (string/int, nullable)
- workplace (nullable)
- title (nullable)
- interests (nullable)
- photo_url (nullable)
- email (nullable)
- phone (nullable)
- linkedin_url (nullable)
- website_url (nullable)
- joined_round_at (nullable)
- hand_cards (array of 4 card ids, nullable)
- total_points (int)
- combos_played (int)
- reached_score_timestamps (optional map total_points->timestamp, or store last_score_update and use monotonic updates)
- created_at, updated_at

**Deck**
- event_id
- deck_index (int) increments when new deck opened
- remaining_cards (set/stack)
- updated_at

**ComboSession**
- combo_id (uuid)
- event_id
- leader_player_id
- invitee_player_id (nullable until joined)
- invite_code (string 5 digits, unique among active pending)
- status: PENDING | ACTIVE | SUBMITTED | CANCELED
- created_at, joined_at, submitted_at, canceled_at
- leader_selected_cards (array)
- final_hand_cards (array of 5)
- final_hand_type (enum)
- score_awarded (int)
- disconnect_grace_expires_at (nullable)
- last_activity_at

**InteractionEdge**
- event_id
- player_a_id
- player_b_id
- combos_total (int)
- combos_submitted (int)
- combos_canceled (int)
- last_combo_at
- cooldown_until (timestamp)

### 11.3 Card Representation
- Standard 52 cards: suit {S,H,D,C}, rank {2..10,J,Q,K,A}
- Represent as string like `AS`, `10H`, `QC`.

---

## 12. APIs (Suggested)

### 12.1 Attendee
- POST /event/enter { event_code }
- POST /player/create_or_load { event_code, device_session_token? }
- PUT /player/profile { fields... }
- POST /round/join
- GET /player/hand
- POST /combo/create_invite -> { invite_code }
- POST /combo/join { invite_code }
- POST /combo/next_from_icebreak
- POST /combo/select { selected_cards[] }
- POST /combo/submit
- POST /combo/leave
- GET /leaderboard
- GET /interactions
- GET /interactions/{other_player_id}

### 12.2 Admin
- POST /admin/login { event_code, admin_pin }
- POST /admin/event/create { event_code, admin_pin, duration, llm_instructions }
- PUT /admin/event/settings { duration, llm_instructions, event_code? }
- POST /admin/round/start
- POST /admin/round/end
- GET /admin/leaderboard
- GET /admin/analytics

---

## 13. Edge Cases and Rules

### 13.1 Invite Code Rules
- Exactly 5 digits (00000–99999), single use.
- QR encodes the same 5 digits.
- No expiration; remains valid while leader keeps invite screen active.
- If leader leaves invite screen, pending invite is canceled and code invalidated.

### 13.2 Round State Enforcement
- Create/join combos only when round state is ACTIVE.
- After round ENDED: read-only mode, no combo actions.

### 13.3 Late Join
- Allowed until round ends.
- Dealing only occurs on pressing Join Round.

### 13.4 Offline Submit
- Submission accepted and points awarded even if invitee offline.
- Invitee receives score upon reconnect.

### 13.5 Name Changes
- Retroactive everywhere.
- Duplicate names always receive suffix format `Name (NNN)`.

---

## 14. Non-Functional Requirements

### 14.1 Performance
- Leaderboard should load quickly for large conferences (consider pagination or top-N + “jump to me” as selected).
- Real-time selection updates can use WebSockets or polling; v1 can use short polling if simpler.

### 14.2 Security
- Admin PIN stored as salted hash.
- Invite codes must map to server-side session state; never compute scores on client.
- Rate-limit invite code guesses.

### 14.3 Privacy
- Inform users that optional profile fields may be shared with participants they interact with.
- No user-facing deletion in v1; retention indefinite per decision.

---

## 15. Open Implementation Notes (Developer)
- Decide whether to support true cross-device “same player identity” without login (requires a transferable rejoin token). If not implemented, restrict takeover semantics to session recovery and clarify UX copy.
- Decide exact tech for photo storage (S3-like object store) and image processing for square crop.

