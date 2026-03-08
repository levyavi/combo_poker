-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_code" TEXT NOT NULL,
    "admin_pin_hash" TEXT NOT NULL,
    "admin_pin_salt" TEXT NOT NULL,
    "round_duration_seconds" INTEGER NOT NULL DEFAULT 1800,
    "llm_instructions" TEXT,
    "round_state" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "round_started_at" DATETIME,
    "round_ends_at" DATETIME,
    "round_ended_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSession_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_event_code_key" ON "Event"("event_code");
