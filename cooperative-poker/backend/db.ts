export type DbRecord = Record<string, unknown> & { id: string };
type DbClient = {
  add(table: string, records: Array<Record<string, unknown>>): Promise<Array<string | null>>;
  get(table: string, ids: string[]): Promise<Array<DbRecord | null>>;
  list(table: string, options?: { filter?: Record<string, unknown>; limit?: number }): Promise<{ items: DbRecord[] }>;
  update(table: string, items: Array<{ id: string; record: Record<string, unknown> }>): Promise<boolean[]>;
  delete(table: string, ids: string[]): Promise<boolean[]>;
};

let db: DbClient;
try {
  const sdk = require("@appdeploy/sdk");
  db = sdk.db as DbClient;
} catch {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  db = {
    async add(table, records) {
      if (table === "events") {
        const ids = await Promise.all(
          records.map(async (r) => {
            const ev = await prisma.event.create({
              data: {
                event_code: r.event_code as string,
                event_title: (r.event_title as string) ?? "",
                openai_api_key: (r.openai_api_key as string) ?? null,
                combo_pair_cooldown_minutes: (r.combo_pair_cooldown_minutes as number) ?? 5,
                hand_scores: (r.hand_scores as string) ?? null,
                llm_instructions: (r.llm_instructions as string) ?? "",
                event_description: (r.event_description as string) ?? "",
                round_state: (r.round_state as string) ?? "NOT_STARTED",
                round_started_at: r.round_started_at != null ? new Date(r.round_started_at as number) : null,
                round_ended_at: r.round_ended_at != null ? new Date(r.round_ended_at as number) : null,
              },
            });
            return ev.id;
          })
        );
        return ids;
      }
      if (table === "players") {
        const ids = await Promise.all(
          records.map(async (r) => {
            const p = await prisma.player.create({
              data: {
                event_id: r.event_id as string,
                device_session_token: (r.device_session_token as string) ?? null,
                display_name: (r.display_name as string) ?? "",
                hand_cards: (r.hand_cards as string) ?? "[]",
                joined_round_at: r.joined_round_at != null ? new Date(r.joined_round_at as number) : null,
                total_score: (r.total_score as number) ?? 0,
                workplace: (r.workplace as string) ?? null,
                title: (r.title as string) ?? null,
                interests: (r.interests as string) ?? null,
                email: (r.email as string) ?? null,
                phone: (r.phone as string) ?? null,
                linkedin_url: (r.linkedin_url as string) ?? null,
                website_url: (r.website_url as string) ?? null,
              },
            });
            return p.id;
          })
        );
        return ids;
      }
      if (table === "combo_sessions") {
        const ids = await Promise.all(
          records.map(async (r) => {
            const c = await prisma.comboSession.create({
              data: {
                event_id: r.event_id as string,
                leader_player_id: r.leader_player_id as string,
                invite_code: r.invite_code as string,
                invitee_player_id: (r.invitee_player_id as string) ?? null,
                state: (r.state as string) ?? "PENDING",
                leader_hand: r.leader_hand as string,
                invitee_hand: (r.invitee_hand as string) ?? "[]",
                selected_cards: (r.selected_cards as string) ?? null,
                score_awarded: (r.score_awarded as number) ?? null,
                hand_rank_name: (r.hand_rank_name as string) ?? null,
                icebreak_question: (r.icebreak_question as string) ?? null,
                submitted_at: r.submitted_at != null ? new Date(r.submitted_at as number) : null,
              },
            });
            return c.id;
          })
        );
        return ids;
      }
      if (table === "interaction_edges") {
        const ids = await Promise.all(
          records.map(async (r) => {
            const e = await prisma.interactionEdge.create({
              data: {
                event_id: r.event_id as string,
                player_a_id: r.player_a_id as string,
                player_b_id: r.player_b_id as string,
                last_combo_at: new Date(r.last_combo_at as number),
              },
            });
            return e.id;
          })
        );
        return ids;
      }
      if (table === "decks") {
        const ids = await Promise.all(
          records.map(async (r) => {
            const d = await prisma.deck.create({
              data: {
                event_id: r.event_id as string,
                deck_index: r.deck_index as number,
                remaining_cards: r.remaining_cards as string,
              },
            });
            return d.id;
          })
        );
        return ids;
      }
      return records.map(() => null);
    },
    async get(table, ids) {
      if (table === "events") {
        const rows = await prisma.event.findMany({ where: { id: { in: ids } } });
        type EventRow = { id: string; event_code: string; event_title: string; openai_api_key: string | null; combo_pair_cooldown_minutes: number; hand_scores: string | null; llm_instructions: string | null; event_description: string | null; round_state: string; round_started_at: Date | null; round_ended_at: Date | null };
        const map = new Map<string, EventRow>(rows.map((r: EventRow) => [r.id, r]));
        return ids.map((id) => {
          const r = map.get(id);
          if (!r) return null;
          return {
            id: r.id,
            event_code: r.event_code,
            event_title: r.event_title ?? "",
            openai_api_key: r.openai_api_key ?? null,
            combo_pair_cooldown_minutes: r.combo_pair_cooldown_minutes,
            hand_scores: r.hand_scores ?? null,
            llm_instructions: r.llm_instructions ?? "",
            event_description: r.event_description ?? "",
            round_state: r.round_state,
            round_started_at: r.round_started_at?.getTime() ?? null,
            round_ended_at: r.round_ended_at?.getTime() ?? null,
          } as DbRecord;
        });
      }
      if (table === "players") {
        const rows = await prisma.player.findMany({ where: { id: { in: ids } } });
        type PlayerRow = { id: string; event_id: string; device_session_token: string | null; display_name: string; hand_cards: string; joined_round_at: Date | null; total_score: number; workplace: string | null; title: string | null; interests: string | null; email: string | null; phone: string | null; linkedin_url: string | null; website_url: string | null };
        const map = new Map<string, PlayerRow>(rows.map((r: PlayerRow) => [r.id, r]));
        return ids.map((id) => {
          const r = map.get(id);
          if (!r) return null;
          return {
            id: r.id,
            event_id: r.event_id,
            device_session_token: r.device_session_token,
            display_name: r.display_name,
            hand_cards: r.hand_cards,
            joined_round_at: r.joined_round_at?.getTime() ?? null,
            total_score: r.total_score,
            workplace: r.workplace,
            title: r.title,
            interests: r.interests,
            email: r.email,
            phone: r.phone,
            linkedin_url: r.linkedin_url,
            website_url: r.website_url,
          } as DbRecord;
        });
      }
      if (table === "combo_sessions") {
        const rows = await prisma.comboSession.findMany({ where: { id: { in: ids } } });
        type ComboRow = { id: string; event_id: string; leader_player_id: string; invite_code: string; invitee_player_id: string | null; state: string; leader_hand: string; invitee_hand: string; selected_cards: string | null; score_awarded: number | null; hand_rank_name: string | null; icebreak_question: string | null; submitted_at: Date | null };
        const map = new Map<string, ComboRow>(rows.map((r: ComboRow) => [r.id, r]));
        return ids.map((id) => {
          const r = map.get(id);
          if (!r) return null;
          return {
            id: r.id,
            event_id: r.event_id,
            leader_player_id: r.leader_player_id,
            invite_code: r.invite_code,
            invitee_player_id: r.invitee_player_id,
            state: r.state,
            leader_hand: r.leader_hand,
            invitee_hand: r.invitee_hand,
            selected_cards: r.selected_cards,
            score_awarded: r.score_awarded,
            hand_rank_name: r.hand_rank_name,
            icebreak_question: r.icebreak_question ?? null,
            submitted_at: r.submitted_at?.getTime() ?? null,
          } as DbRecord;
        });
      }
      if (table === "interaction_edges") {
        const rows = await prisma.interactionEdge.findMany({ where: { id: { in: ids } } });
        type EdgeRow = { id: string; event_id: string; player_a_id: string; player_b_id: string; last_combo_at: Date };
        const map = new Map<string, EdgeRow>(rows.map((r: EdgeRow) => [r.id, r]));
        return ids.map((id) => {
          const r = map.get(id);
          if (!r) return null;
          return {
            id: r.id,
            event_id: r.event_id,
            player_a_id: r.player_a_id,
            player_b_id: r.player_b_id,
            last_combo_at: r.last_combo_at.getTime(),
          } as DbRecord;
        });
      }
      if (table === "decks") {
        const rows = await prisma.deck.findMany({ where: { id: { in: ids } } });
        type DeckRow = { id: string; event_id: string; deck_index: number; remaining_cards: string };
        const map = new Map<string, DeckRow>(rows.map((r: DeckRow) => [r.id, r]));
        return ids.map((id) => {
          const r = map.get(id);
          if (!r) return null;
          return {
            id: r.id,
            event_id: r.event_id,
            deck_index: r.deck_index,
            remaining_cards: r.remaining_cards,
          } as DbRecord;
        });
      }
      return ids.map(() => null);
    },
    async list(table, options) {
      if (table === "events") {
        const where = options?.filter ? { event_code: options.filter.event_code as string } : {};
        const rows = await prisma.event.findMany({ where, take: options?.limit ?? 1000 } as { where: object; take: number });
        type EventListRow = { id: string; event_code: string; event_title: string; openai_api_key: string | null; combo_pair_cooldown_minutes: number; hand_scores: string | null; llm_instructions: string | null; event_description: string | null; round_state: string; round_started_at: Date | null; round_ended_at: Date | null };
        return {
          items: rows.map((r: EventListRow) => ({
            id: r.id,
            event_code: r.event_code,
            event_title: r.event_title ?? "",
            openai_api_key: r.openai_api_key ?? null,
            combo_pair_cooldown_minutes: r.combo_pair_cooldown_minutes,
            hand_scores: r.hand_scores ?? null,
            llm_instructions: r.llm_instructions ?? "",
            event_description: r.event_description ?? "",
            round_state: r.round_state,
            round_started_at: r.round_started_at?.getTime() ?? null,
            round_ended_at: r.round_ended_at?.getTime() ?? null,
          })),
        };
      }
      if (table === "players") {
        const filter = options?.filter as { event_id?: string; device_session_token?: string } | undefined;
        const where: { event_id?: string; device_session_token?: string | null } = {};
        if (filter?.event_id) where.event_id = filter.event_id;
        if (filter?.device_session_token !== undefined) where.device_session_token = filter.device_session_token || null;
        const rows = await prisma.player.findMany({ where, take: options?.limit ?? 1000 } as { where: object; take: number });
        type PlayerRow = { id: string; event_id: string; device_session_token: string | null; display_name: string; hand_cards: string; joined_round_at: Date | null; total_score: number; workplace: string | null; title: string | null; interests: string | null; email: string | null; phone: string | null; linkedin_url: string | null; website_url: string | null };
        return {
          items: rows.map((r: PlayerRow) => ({
            id: r.id,
            event_id: r.event_id,
            device_session_token: r.device_session_token,
            display_name: r.display_name,
            hand_cards: r.hand_cards,
            joined_round_at: r.joined_round_at?.getTime() ?? null,
            total_score: r.total_score,
            workplace: r.workplace,
            title: r.title,
            interests: r.interests,
            email: r.email,
            phone: r.phone,
            linkedin_url: r.linkedin_url,
            website_url: r.website_url,
          })),
        };
      }
      if (table === "combo_sessions") {
        const filter = options?.filter as { event_id?: string; invite_code?: string; leader_player_id?: string; invitee_player_id?: string; state?: string } | undefined;
        const where: Record<string, unknown> = {};
        if (filter?.event_id) where.event_id = filter.event_id;
        if (filter?.invite_code) where.invite_code = filter.invite_code;
        if (filter?.leader_player_id) where.leader_player_id = filter.leader_player_id;
        if (filter?.invitee_player_id !== undefined) where.invitee_player_id = filter.invitee_player_id || null;
        if (filter?.state) where.state = filter.state;
        const rows = await prisma.comboSession.findMany({ where, take: options?.limit ?? 100 } as { where: object; take: number });
        type ComboRow = { id: string; event_id: string; leader_player_id: string; invite_code: string; invitee_player_id: string | null; state: string; leader_hand: string; invitee_hand: string; selected_cards: string | null; score_awarded: number | null; hand_rank_name: string | null; icebreak_question: string | null; submitted_at: Date | null };
        return {
          items: rows.map((r: ComboRow) => ({
            id: r.id,
            event_id: r.event_id,
            leader_player_id: r.leader_player_id,
            invite_code: r.invite_code,
            invitee_player_id: r.invitee_player_id,
            state: r.state,
            leader_hand: r.leader_hand,
            invitee_hand: r.invitee_hand,
            selected_cards: r.selected_cards,
            score_awarded: r.score_awarded,
            hand_rank_name: r.hand_rank_name,
            icebreak_question: r.icebreak_question ?? null,
            submitted_at: r.submitted_at?.getTime() ?? null,
          })),
        };
      }
      if (table === "interaction_edges") {
        const filter = options?.filter as { event_id?: string; player_a_id?: string; player_b_id?: string } | undefined;
        const where: Record<string, unknown> = {};
        if (filter?.event_id) where.event_id = filter.event_id;
        if (filter?.player_a_id) where.player_a_id = filter.player_a_id;
        if (filter?.player_b_id) where.player_b_id = filter.player_b_id;
        const rows = await prisma.interactionEdge.findMany({ where, take: options?.limit ?? 100 } as { where: object; take: number });
        type EdgeRow = { id: string; event_id: string; player_a_id: string; player_b_id: string; last_combo_at: Date };
        return {
          items: rows.map((r: EdgeRow) => ({
            id: r.id,
            event_id: r.event_id,
            player_a_id: r.player_a_id,
            player_b_id: r.player_b_id,
            last_combo_at: r.last_combo_at.getTime(),
          })),
        };
      }
      if (table === "decks") {
        const filter = options?.filter as { event_id?: string } | undefined;
        const where = filter?.event_id ? { event_id: filter.event_id } : {};
        const rows = await prisma.deck.findMany({ where, orderBy: { deck_index: "desc" }, take: options?.limit ?? 100 } as { where: object; orderBy: object; take: number });
        type DeckRow = { id: string; event_id: string; deck_index: number; remaining_cards: string };
        return {
          items: rows.map((r: DeckRow) => ({
            id: r.id,
            event_id: r.event_id,
            deck_index: r.deck_index,
            remaining_cards: r.remaining_cards,
          })),
        };
      }
      return { items: [] };
    },
    async update(table, items) {
      if (table === "events") {
        return Promise.all(
          items.map(async ({ id, record }) => {
            const r = record as Record<string, unknown>;
            const data: Record<string, unknown> = {};
            if (r.round_state !== undefined) data.round_state = r.round_state as string;
            if (r.round_started_at !== undefined) data.round_started_at = r.round_started_at != null ? new Date(r.round_started_at as number) : null;
            if (r.round_ended_at !== undefined) data.round_ended_at = r.round_ended_at != null ? new Date(r.round_ended_at as number) : null;
            if (r.event_code !== undefined) data.event_code = r.event_code as string;
            if (r.event_title !== undefined) data.event_title = (r.event_title as string) ?? "";
            if (r.openai_api_key !== undefined) data.openai_api_key = (r.openai_api_key as string) ?? null;
            if (r.combo_pair_cooldown_minutes !== undefined) data.combo_pair_cooldown_minutes = (r.combo_pair_cooldown_minutes as number) ?? 5;
            if (r.hand_scores !== undefined) data.hand_scores = (r.hand_scores as string) ?? null;
            if (r.llm_instructions !== undefined) data.llm_instructions = (r.llm_instructions as string) ?? "";
            if (r.event_description !== undefined) data.event_description = (r.event_description as string) ?? "";
            await prisma.event.update({
              where: { id },
              data: data as { round_state?: string; round_started_at?: Date | null; round_ended_at?: Date | null; event_code?: string; event_title?: string; openai_api_key?: string | null; combo_pair_cooldown_minutes?: number; hand_scores?: string | null; llm_instructions?: string; event_description?: string },
            });
            return true;
          })
        );
      }
      if (table === "players") {
        return Promise.all(
          items.map(async ({ id, record }) => {
            await prisma.player.update({
              where: { id },
              data: {
                display_name: record.display_name as string,
                hand_cards: record.hand_cards as string,
                joined_round_at: record.joined_round_at != null ? new Date(record.joined_round_at as number) : null,
                total_score: (record.total_score as number) ?? 0,
                workplace: (record.workplace as string) ?? null,
                title: (record.title as string) ?? null,
                interests: (record.interests as string) ?? null,
                email: (record.email as string) ?? null,
                phone: (record.phone as string) ?? null,
                linkedin_url: (record.linkedin_url as string) ?? null,
                website_url: (record.website_url as string) ?? null,
              },
            });
            return true;
          })
        );
      }
      if (table === "combo_sessions") {
        return Promise.all(
          items.map(async ({ id, record }) => {
            const r = record as Record<string, unknown>;
            const data: Record<string, unknown> = {};
            if (r.event_id !== undefined) data.event_id = r.event_id as string;
            if (r.leader_player_id !== undefined) data.leader_player_id = r.leader_player_id as string;
            if (r.invite_code !== undefined) data.invite_code = r.invite_code as string;
            if (r.invitee_player_id !== undefined) data.invitee_player_id = (r.invitee_player_id as string) ?? null;
            if (r.state !== undefined) data.state = r.state as string;
            if (r.leader_hand !== undefined) data.leader_hand = r.leader_hand as string;
            if (r.invitee_hand !== undefined) data.invitee_hand = (r.invitee_hand as string) ?? "[]";
            if (r.selected_cards !== undefined) data.selected_cards = (r.selected_cards as string) ?? null;
            if (r.score_awarded !== undefined) data.score_awarded = (r.score_awarded as number) ?? null;
            if (r.hand_rank_name !== undefined) data.hand_rank_name = (r.hand_rank_name as string) ?? null;
            if (r.icebreak_question !== undefined) data.icebreak_question = (r.icebreak_question as string) ?? null;
            if (r.submitted_at !== undefined) data.submitted_at = r.submitted_at != null ? new Date(r.submitted_at as number) : null;
            await prisma.comboSession.update({
              where: { id },
              data: data as Record<string, unknown>,
            });
            return true;
          })
        );
      }
      if (table === "interaction_edges") {
        return Promise.all(
          items.map(async ({ id, record }) => {
            await prisma.interactionEdge.update({
              where: { id },
              data: { last_combo_at: new Date(record.last_combo_at as number) },
            });
            return true;
          })
        );
      }
      if (table === "decks") {
        return Promise.all(
          items.map(async ({ id, record }) => {
            await prisma.deck.update({
              where: { id },
              data: { remaining_cards: record.remaining_cards as string },
            });
            return true;
          })
        );
      }
      return items.map(() => false);
    },
    async delete(table, ids) {
      if (table === "events") {
        return Promise.all(
          ids.map(async (id) => {
            try {
              await prisma.event.delete({ where: { id } });
              return true;
            } catch {
              return false;
            }
          })
        );
      }
      return ids.map(() => false);
    },
  };
}

export { db };
