import type { LambdaEvent, LambdaResponse } from "./types";

export function getCorsHeaders(event: LambdaEvent): Record<string, string> {
  const origin = event.headers?.origin ?? event.headers?.Origin ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": origin === "*" ? "false" : "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Session",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonResponse(statusCode: number, data: unknown, extraHeaders?: Record<string, string>): LambdaResponse {
  return {
    statusCode,
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json", ...extraHeaders },
  };
}

export function parseBody(event: LambdaEvent & { isBase64Encoded?: boolean }): Record<string, unknown> {
  if (event.body == null) return {};
  if (typeof event.body === "object") return event.body as Record<string, unknown>;
  let str = event.body as string;
  if (event.isBase64Encoded && typeof Buffer !== "undefined") {
    try {
      str = Buffer.from(str, "base64").toString("utf8");
    } catch {
      return {};
    }
  }
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getBody(event: LambdaEvent): Record<string, unknown> {
  const raw = parseBody(event) as Record<string, unknown>;
  let body = raw;
  if (raw.body !== undefined) {
    if (typeof raw.body === "object" && raw.body !== null) body = raw.body as Record<string, unknown>;
    else if (typeof raw.body === "string") {
      try {
        body = JSON.parse(raw.body) as Record<string, unknown>;
      } catch {
        /* use raw */
      }
    }
  }
  if (body.data && typeof body.data === "object" && body.data !== null) {
    body = body.data as Record<string, unknown>;
  }
  return body;
}

export function normEventCode(v: unknown): string {
  const s = v != null ? String(v) : "";
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getQueryParams(event: LambdaEvent): Record<string, string | undefined> {
  const q = event.queryStringParameters ?? {};
  const raw = (event.rawPath ?? event.path ?? "").toString();
  const i = raw.indexOf("?");
  if (i >= 0) {
    const fromPath = Object.fromEntries(new URLSearchParams(raw.slice(i)));
    return { ...fromPath, ...q };
  }
  return q;
}
