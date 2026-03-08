import type { LambdaEvent, LambdaResponse } from "./types";
import { jsonResponse } from "./http-utils";

const GATE_COOKIE_NAME = "admin_gate";
const GATE_MAX_AGE_SEC = 604800; // 7 days
export const ADMIN_GATE_PIN = (process.env.ADMIN_PIN ?? "001234").toLowerCase();

export function getGateCookie(event: LambdaEvent): string | null {
  const raw = event.headers?.cookie ?? event.headers?.Cookie ?? "";
  const match = raw.match(new RegExp(`${GATE_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export function setGateCookie(): string {
  return `${GATE_COOKIE_NAME}=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=${GATE_MAX_AGE_SEC}`;
}

export function getAdminSessionToken(event: LambdaEvent): string | null {
  const headers = event.headers ?? {};
  const auth = headers.authorization ?? headers.Authorization;
  if (auth && auth.toString().startsWith("Bearer ")) {
    const token = auth.toString().slice("Bearer ".length).trim();
    if (token) return token;
  }
  const xAdmin =
    (headers["x-admin-session"] as string | undefined) ??
    (headers["X-Admin-Session"] as string | undefined);
  if (xAdmin && xAdmin.toString().trim() !== "") return xAdmin.toString().trim();
  const q = event.queryStringParameters ?? {};
  const qp = q.session_token;
  if (qp && qp.toString().trim() !== "") return qp.toString().trim();
  return null;
}

export function isGateUnlocked(event: LambdaEvent): boolean {
  if (getGateCookie(event)) return true;
  const token = getAdminSessionToken(event);
  if (!token) return false;
  return token.toLowerCase() === ADMIN_GATE_PIN;
}

export function requireGate(event: LambdaEvent): LambdaResponse | null {
  if (!isGateUnlocked(event)) return jsonResponse(403, { error: "Admin gate required" });
  return null;
}
