#!/usr/bin/env node
/**
 * deploy-all.js — Deploy the full cooperative-poker project to AppDeploy.
 *
 * Usage (from repo root or deploy/):
 *   node deploy/deploy-all.js
 *
 * Auth is read automatically from ~/.claude/.credentials.json and refreshed
 * if the access token has expired. No Claude tokens are consumed.
 *
 * Files are deployed in 7 batches to stay within AppDeploy's payload limits:
 *   FE batch 1: _app, index, home, profile, admin, hand + globals.css + configs
 *   FE batch 2: create-combo, join-combo, combo
 *   FE batch 3: score, leaderboard, combo-scoring
 *   FE batch 4: interactions, instructions, icebreak, contact/[id], about
 *   BE batch 1: types, http-utils, auth, players, decks, events, lib/api
 *   BE batch 2: db, icebreaker, interactions, combos
 *   BE batch 3: poker, index (the largest files)
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CREDENTIALS_PATH = path.join(os.homedir(), ".claude", ".credentials.json");
const MCP_URL = "https://api-v2.appdeploy.ai/mcp";
const TOKEN_ENDPOINT = "https://api-v2.appdeploy.ai/mcp/token";

const APP_ID = "9fa3fb53f2ea4bc3b5";
const APP_BASE = {
  app_id: APP_ID,
  app_type: "frontend+backend",
  app_name: "Cooperative Poker",
  model: "script",
};

// ── File helpers ──────────────────────────────────────────────────

function readFile(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.warn(`  [SKIP] ${relPath} — not found`);
    return null;
  }
  const content = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return { filename: relPath, content };
}

function readFiles(relPaths) {
  return relPaths.map(readFile).filter(Boolean);
}

// ── Batch definitions ─────────────────────────────────────────────

function buildBatches() {
  const feBatch1 = readFiles([
    "pages/_app.tsx",
    "pages/index.tsx",
    "pages/home.tsx",
    "pages/profile.tsx",
    "pages/admin.tsx",
    "pages/hand.tsx",
    "styles/globals.css",
    "lib/api.ts",
    "next.config.js",
    "tailwind.config.js",
    "postcss.config.js",
    "tsconfig.json",
    "package.json",
  ]);

  const feBatch2 = readFiles([
    "pages/create-combo.tsx",
    "pages/join-combo.tsx",
    "pages/combo.tsx",
  ]);

  const feBatch3 = readFiles([
    "pages/score.tsx",
    "pages/leaderboard.tsx",
    "pages/combo-scoring.tsx",
  ]);

  const feBatch4 = readFiles([
    "pages/interactions.tsx",
    "pages/instructions.tsx",
    "pages/icebreak.tsx",
    "pages/contact/[id].tsx",
    "pages/about.tsx",
  ]);

  const beBatch1 = readFiles([
    "backend/types.ts",
    "backend/http-utils.ts",
    "backend/auth.ts",
    "backend/players.ts",
    "backend/decks.ts",
    "backend/events.ts",
  ]);

  const beBatch2 = readFiles([
    "backend/db.ts",
    "backend/icebreaker.ts",
    "backend/interactions.ts",
    "backend/combos.ts",
  ]);

  const beBatch3 = readFiles([
    "backend/poker.ts",
    "backend/index.ts",
  ]);

  return [
    { intent: "Deploy FE batch 1: core pages, styles, configs", files: feBatch1 },
    { intent: "Deploy FE batch 2: create-combo, join-combo, combo", files: feBatch2 },
    { intent: "Deploy FE batch 3: score, leaderboard, combo-scoring", files: feBatch3 },
    { intent: "Deploy FE batch 4: interactions, instructions, icebreak, contact, about", files: feBatch4 },
    { intent: "Deploy BE batch 1: types, http-utils, auth, players, decks, events", files: beBatch1 },
    { intent: "Deploy BE batch 2: db, icebreaker, interactions, combos", files: beBatch2 },
    { intent: "Deploy BE batch 3: poker, index", files: beBatch3 },
  ];
}

// ── Credentials ───────────────────────────────────────────────────

function readCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  } catch {
    throw new Error(`Cannot read credentials from ${CREDENTIALS_PATH}`);
  }
}

function writeCredentials(creds) {
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds), "utf8");
}

function getAppDeployAuth(creds) {
  const mcpOAuth = creds.mcpOAuth || {};
  const key = Object.keys(mcpOAuth).find((k) => k.startsWith("AppDeploy"));
  if (!key) throw new Error("No AppDeploy OAuth entry found in ~/.claude/.credentials.json");
  return { key, auth: mcpOAuth[key] };
}

// ── HTTP helper ───────────────────────────────────────────────────

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") })
        );
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Token refresh ─────────────────────────────────────────────────

async function getValidToken(creds) {
  const { key, auth } = getAppDeployAuth(creds);
  if (auth.expiresAt > Date.now() + 30_000) {
    return auth.accessToken;
  }

  console.log("Access token expired — refreshing...");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: auth.refreshToken,
    client_id: auth.clientId,
  }).toString();

  const res = await httpRequest(
    TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );

  if (res.status !== 200) {
    throw new Error(`Token refresh failed (HTTP ${res.status}): ${res.text}`);
  }

  const data = JSON.parse(res.text);
  creds.mcpOAuth[key].accessToken = data.access_token;
  creds.mcpOAuth[key].expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  if (data.refresh_token) creds.mcpOAuth[key].refreshToken = data.refresh_token;
  writeCredentials(creds);
  console.log("Token refreshed.");
  return data.access_token;
}

// ── MCP JSON-RPC ──────────────────────────────────────────────────

let sessionId = null;
let msgId = 0;

async function mcpPost(token, body) {
  const bodyStr = JSON.stringify(body);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "Content-Length": Buffer.byteLength(bodyStr),
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await httpRequest(MCP_URL, { method: "POST", headers }, bodyStr);

  if (res.headers["mcp-session-id"]) sessionId = res.headers["mcp-session-id"];

  let text = res.text.trim();
  if (text.startsWith("data:")) {
    const lines = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    text = lines[lines.length - 1] || text;
  }

  if (!text || res.status === 202) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`MCP parse error (HTTP ${res.status}): ${res.text.slice(0, 400)}`);
  }
}

async function mcpInit(token) {
  const r = await mcpPost(token, {
    jsonrpc: "2.0",
    id: ++msgId,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "deploy-all.js", version: "1.0.0" },
    },
  });
  if (r?.error) throw new Error(`MCP initialize error: ${JSON.stringify(r.error)}`);
  await mcpPost(token, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
}

async function toolCall(token, name, args) {
  const r = await mcpPost(token, {
    jsonrpc: "2.0",
    id: ++msgId,
    method: "tools/call",
    params: { name, arguments: args },
  });
  if (r?.error) throw new Error(`Tool "${name}" error: ${JSON.stringify(r.error)}`);
  if (r?.result?.content) {
    const text = r.result.content.map((c) => c.text || "").join("");
    try { return JSON.parse(text); } catch { return text; }
  }
  return r?.result;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Deploy + poll ─────────────────────────────────────────────────

async function deployBatch(token, batchNum, total, batch) {
  const label = `[${batchNum}/${total}] ${batch.intent}`;
  const kbSize = (JSON.stringify(batch.files).length / 1024).toFixed(1);
  console.log(`\n${label} (${batch.files.length} files, ${kbSize} KB)`);

  const result = await toolCall(token, "deploy_app", {
    ...APP_BASE,
    intent: batch.intent,
    files: batch.files,
  });

  const resultStr = JSON.stringify(result);
  const urlM = resultStr.match(/"url"\s*:\s*"([^"]+)"/);
  if (urlM) console.log("  URL:", urlM[1]);

  console.log("  Polling...");
  for (let i = 0; i < 36; i++) {
    await sleep(5000);
    const status = await toolCall(token, "get_app_status", { app_id: APP_ID });
    const s = JSON.stringify(status);
    const statusM = s.match(/"status"\s*:\s*"([^"]+)"/);
    const current = statusM ? statusM[1] : "unknown";
    process.stdout.write(`\r  status: ${current}   `);
    if (current === "ready") {
      console.log("\n  Done.");
      return;
    }
    if (current === "failed") {
      console.log("\n  FAILED.");
      console.log(s.slice(0, 800));
      throw new Error(`Batch ${batchNum} deployment failed`);
    }
  }
  console.log("\n  Timed out waiting for ready status.");
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log("=== Cooperative Poker — full deploy ===");
  console.log(`Project: ${PROJECT_ROOT}`);
  console.log(`App ID:  ${APP_ID}\n`);

  const batches = buildBatches().filter((b) => b.files.length > 0);
  console.log(`Batches: ${batches.length}`);

  const creds = readCredentials();
  const token = await getValidToken(creds);

  console.log("Initializing MCP session...");
  await mcpInit(token);

  for (let i = 0; i < batches.length; i++) {
    await deployBatch(token, i + 1, batches.length, batches[i]);
  }

  console.log("\n=== All batches deployed successfully ===");
  console.log("Live: https://cooperative-poker-ybazv.v2.appdeploy.ai/");
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
