/**
 * Local API client for development. Uses same-origin fetch to Next.js API routes.
 * On AppDeploy the platform provides @appdeploy/client; this module is used when running locally.
 * When NEXT_PUBLIC_API_URL is set (e.g. http://localhost:3001), requests are sent there for local dev.
 */

const API_BASE = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL ?? "" : "";

function baseUrl(url: string): string {
  if (!API_BASE || url.startsWith("http")) return url;
  return API_BASE.replace(/\/$/, "") + url;
}

function isOptions(
  body: Record<string, unknown> | { body?: string; headers?: Record<string, string> } | undefined
): body is { body?: string; headers?: Record<string, string> } {
  return body != null && typeof body === "object" && ("body" in body || "headers" in body);
}

export const api = {
  get(url: string, options?: { headers?: Record<string, string> }): Promise<Response> {
    return fetch(baseUrl(url), {
      method: "GET",
      headers: options?.headers,
      credentials: "include",
      cache: "no-store",
    });
  },

  post(
    url: string,
    body?: Record<string, unknown> | { body?: string; headers?: Record<string, string> }
  ): Promise<Response> {
    const target = baseUrl(url);
    if (body == null) return fetch(target, { method: "POST", credentials: "include" });
    if (isOptions(body)) {
      return fetch(target, {
        method: "POST",
        body: body.body,
        headers: body.headers ?? { "Content-Type": "application/json" },
        credentials: "include",
      });
    }
    return fetch(target, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
  },

  put(
    url: string,
    body?: Record<string, unknown> | { body?: string; headers?: Record<string, string> }
  ): Promise<Response> {
    const target = baseUrl(url);
    if (body == null) return fetch(target, { method: "PUT", credentials: "include" });
    if (isOptions(body)) {
      return fetch(target, {
        method: "PUT",
        body: body.body,
        headers: body.headers ?? { "Content-Type": "application/json" },
        credentials: "include",
      });
    }
    return fetch(target, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
  },
};
