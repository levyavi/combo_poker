-- CreateTable
CREATE TABLE "ComboSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "leader_player_id" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "invitee_player_id" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "leader_hand" TEXT NOT NULL,
    "invitee_hand" TEXT NOT NULL DEFAULT '[]',
    "selected_cards" TEXT,
    "score_awarded" INTEGER,
    "hand_rank_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "submitted_at" DATETIME,
    CONSTRAINT "ComboSession_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InteractionEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "player_a_id" TEXT NOT NULL,
    "player_b_id" TEXT NOT NULL,
    "last_combo_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InteractionEdge_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_code" TEXT NOT NULL,
    "admin_pin_hash" TEXT NOT NULL,
    "admin_pin_salt" TEXT NOT NULL,
    "round_duration_seconds" INTEGER NOT NULL DEFAULT 1800,
    "llm_instructions" TEXT DEFAULT '',
    "round_state" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "round_started_at" DATETIME,
    "round_ends_at" DATETIME,
    "round_ended_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("admin_pin_hash", "admin_pin_salt", "created_at", "event_code", "id", "llm_instructions", "round_duration_seconds", "round_ended_at", "round_ends_at", "round_started_at", "round_state", "updated_at") SELECT "admin_pin_hash", "admin_pin_salt", "created_at", "event_code", "id", "llm_instructions", "round_duration_seconds", "round_ended_at", "round_ends_at", "round_started_at", "round_state", "updated_at" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_event_code_key" ON "Event"("event_code");
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "device_session_token" TEXT,
    "display_name" TEXT NOT NULL DEFAULT '',
    "hand_cards" TEXT NOT NULL DEFAULT '[]',
    "joined_round_at" DATETIME,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "workplace" TEXT,
    "title" TEXT,
    "interests" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedin_url" TEXT,
    "website_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Player_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("created_at", "device_session_token", "display_name", "email", "event_id", "hand_cards", "id", "interests", "joined_round_at", "linkedin_url", "phone", "title", "updated_at", "website_url", "workplace") SELECT "created_at", "device_session_token", "display_name", "email", "event_id", "hand_cards", "id", "interests", "joined_round_at", "linkedin_url", "phone", "title", "updated_at", "website_url", "workplace" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "InteractionEdge_event_id_player_a_id_player_b_id_key" ON "InteractionEdge"("event_id", "player_a_id", "player_b_id");
