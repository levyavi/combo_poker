import type { LambdaEvent, LambdaResponse } from "./types";
import { getCorsHeaders, jsonResponse } from "./http-utils";
import { postEventEnter, getEvents, getAdminGateStatus, postAdminGate, getAdminEvent, postAdminEventDelete, postAdminEventStart, postAdminEventEnd, postAdminEventCreate, postAdminEventUpdate } from "./events";
import { postPlayerCreateOrLoad, putPlayerProfile, getPlayerHand } from "./players";
import { postRoundJoin } from "./decks";
import { postComboCreateInvite, postComboJoin, postComboSelect, postComboSubmit, postComboLeave, getComboState, getComboMine } from "./combos";
import { getIcebreakQuestion } from "./icebreaker";
import { getLeaderboard, getInteractions } from "./interactions";

function router(handlers: Record<string, (e: LambdaEvent) => Promise<LambdaResponse>>) {
  return async (event: LambdaEvent): Promise<LambdaResponse> => {
    const method = (event.httpMethod || "GET").toUpperCase();
    const path = (event.rawPath ?? event.path ?? "/").replace(/\?.*$/, "").replace(/\/$/, "") || "/";

    if (method === "OPTIONS") {
      return { statusCode: 204, body: "", headers: getCorsHeaders(event) };
    }

    const key = `${method} ${path}`;
    let handler = handlers[key];
    if (!handler && method === "GET" && (path === "/api/interactions" || path.startsWith("/api/interactions/"))) {
      handler = getInteractions;
    }
    if (!handler) {
      const res = jsonResponse(404, { error: "Not found" });
      res.headers = { ...getCorsHeaders(event), ...(res.headers || {}) };
      return res;
    }
    try {
      const res = await handler(event);
      res.headers = { ...getCorsHeaders(event), ...(res.headers || {}) };
      return res;
    } catch (err) {
      const res = jsonResponse(500, { error: err instanceof Error ? err.message : String(err) });
      res.headers = { ...getCorsHeaders(event), ...(res.headers || {}) };
      return res;
    }
  };
}

export const handler = router({
  "GET /api/events": getEvents,
  "POST /api/event/enter": postEventEnter,
  "POST /api/player/create_or_load": postPlayerCreateOrLoad,
  "PUT /api/player/profile": putPlayerProfile,
  "POST /api/round/join": postRoundJoin,
  "GET /api/player/hand": getPlayerHand,
  "POST /api/combo/create_invite": postComboCreateInvite,
  "POST /api/combo/join": postComboJoin,
  "POST /api/combo/select": postComboSelect,
  "POST /api/combo/submit": postComboSubmit,
  "POST /api/combo/leave": postComboLeave,
  "GET /api/combo/state": getComboState,
  "GET /api/combo/mine": getComboMine,
  "GET /api/icebreak/question": getIcebreakQuestion,
  "GET /api/interactions": getInteractions,
  "GET /api/leaderboard": getLeaderboard,
  "GET /api/admin/gate-status": getAdminGateStatus,
  "POST /api/admin/gate": postAdminGate,
  "POST /api/admin/event/create": postAdminEventCreate,
  "GET /api/admin/event": getAdminEvent,
  "POST /api/admin/event/delete": postAdminEventDelete,
  "POST /api/admin/event/update": postAdminEventUpdate,
  "POST /api/admin/event/start": postAdminEventStart,
  "POST /api/admin/event/end": postAdminEventEnd,
});

export default handler;
