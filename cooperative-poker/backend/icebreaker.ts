import { db } from "./db";
import type { LambdaEvent, LambdaResponse } from "./types";
import { EVENTS_TABLE, PLAYERS_TABLE, COMBO_SESSIONS_TABLE } from "./types";
import { jsonResponse, getQueryParams } from "./http-utils";
import { resolvePlayer } from "./players";
import { findComboByInviteCode } from "./combos";

function getAnyKey(rec: Record<string, unknown>, ...targetKeys: string[]): string {
  const lowerTargets = new Set(targetKeys.map((k) => k.toLowerCase()));
  for (const [key, value] of Object.entries(rec)) {
    if (value != null && String(value).trim() !== "" && lowerTargets.has(key.toLowerCase())) return String(value).trim();
  }
  return "";
}

export function profileForLlm(p: Record<string, unknown>): Record<string, unknown> {
  const displayName = ((p.display_name ?? p.displayName ?? getAnyKey(p, "display_name", "displayName")) || "").toString().trim();
  return {
    display_name: displayName || "",
    workplace: (p.workplace ?? getAnyKey(p, "workplace")) || null,
    title: (p.title ?? getAnyKey(p, "title")) || null,
    interests: (p.interests ?? getAnyKey(p, "interests")) || null,
  };
}

const PREDETERMINED_ICEBREAK_QUESTIONS = [
  "What's one thing you'd like to learn about your partner today?",
  "What do you and your partner have in common? Share one interest or experience.",
  "Break the ice: introduce yourselves and find one thing you have in common.",
  "If you could have coffee with anyone, who would it be and why?",
  "What's a hobby or project you're excited about right now?",
  "What's the best piece of advice you've received recently?",
  "What's something you're curious to learn more about?",
  "What would you like to ask each other about your work or interests?",
];

function deterministicQuestionIndex(comboId: string): number {
  let h = 0;
  for (let i = 0; i < comboId.length; i++) h = (h * 31 + comboId.charCodeAt(i)) >>> 0;
  return h % PREDETERMINED_ICEBREAK_QUESTIONS.length;
}

async function callOpenAiForIcebreak(apiKey: string, instructions: string, profile1: Record<string, unknown>, profile2: Record<string, unknown>): Promise<string> {
  const prompt = [
    instructions.trim(),
    `This is some info on one person:\n${JSON.stringify(profile1, null, 2)}`,
    `This is some info on the other person:\n${JSON.stringify(profile2, null, 2)}`,
    "Generate a single short icebreaker question for these two people. Reply with only the question, no quotes or prefix.",
  ].filter(Boolean).join("\n\n");
  const requestBody = { model: "gpt-4o-mini", messages: [{ role: "user" as const, content: prompt }], max_tokens: 150 };
  console.log("[icebreak] LLM request:", JSON.stringify(requestBody, null, 2));
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify(requestBody),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.log("[icebreak] LLM error response:", res.status, errText);
    throw new Error(`OpenAI API error: ${res.status} ${errText}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  console.log("[icebreak] LLM response:", JSON.stringify(data, null, 2));
  const text = data.choices?.[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : PREDETERMINED_ICEBREAK_QUESTIONS[0]!;
}

export async function getIcebreakQuestion(event: LambdaEvent): Promise<LambdaResponse> {
  const q = getQueryParams(event);
  const inviteCode = q.invite_code as string | undefined;
  if (!inviteCode?.trim()) return jsonResponse(400, { error: "invite_code required" });
  const resolved = await resolvePlayer({
    ...event,
    body: { player_id: q.player_id, event_code: q.event_code, device_session_token: q.device_session_token ?? q.deviceSessionToken },
  });
  if ("statusCode" in resolved) return resolved;
  const { player, eventRecord } = resolved;
  const playerId = player.id;
  const combo = await findComboByInviteCode(inviteCode.trim());
  if (!combo) return jsonResponse(404, { error: "Invite not found" });
  const cr = combo as Record<string, unknown>;
  const leaderId = cr.leader_player_id as string;
  const inviteeId = cr.invitee_player_id as string | undefined;
  if (playerId !== leaderId && playerId !== inviteeId) return jsonResponse(403, { error: "Not in this combo" });
  const otherId = playerId === leaderId ? inviteeId : leaderId;
  if (!otherId) {
    return jsonResponse(200, { question: "Share your invite code with your partner. Once they join, you'll see a question here to get the conversation started.", waiting_for_partner: true });
  }
  const [leaderRow] = await db.get(PLAYERS_TABLE, [leaderId]);
  const [inviteeRow] = await db.get(PLAYERS_TABLE, [otherId]);
  if (!leaderRow || !inviteeRow) return jsonResponse(404, { error: "Player not found" });
  const p1 = profileForLlm(leaderRow as Record<string, unknown>);
  const p2 = profileForLlm(inviteeRow as Record<string, unknown>);
  const isLeader = playerId === leaderId;
  const questionKey = isLeader ? "icebreak_question_leader" : "icebreak_question_invitee";
  let question = cr[questionKey] as string | undefined;
  if (question == null || question.trim() === "") {
    const [ev] = await db.get(EVENTS_TABLE, [eventRecord.id]);
    const evRec = ev as Record<string, unknown> | undefined;
    const openaiApiKey = (evRec?.openai_api_key as string | null | undefined) ?? null;
    const llmInstructions = ((evRec?.llm_instructions ?? "") as string).trim();
    if (openaiApiKey && openaiApiKey.trim().length > 0) {
      try {
        const askingProfile = profileForLlm(player as Record<string, unknown>);
        const resolvedInstructions = (llmInstructions || "Generate a short, friendly icebreaker question for two people at a networking event.")
          .replace(/\{\{asking\}\}/g, JSON.stringify(askingProfile, null, 2))
          .replace(/\{\{asked\}\}/g, JSON.stringify(p2, null, 2));
        question = await callOpenAiForIcebreak(openaiApiKey, resolvedInstructions, p1, p2);
      } catch {
        question = PREDETERMINED_ICEBREAK_QUESTIONS[deterministicQuestionIndex((combo as { id: string }).id)]!;
      }
    } else {
      question = PREDETERMINED_ICEBREAK_QUESTIONS[deterministicQuestionIndex((combo as { id: string }).id)]!;
    }
    const comboId = (combo as { id?: string }).id;
    if (comboId) await db.update(COMBO_SESSIONS_TABLE, [{ id: comboId, record: { ...cr, [questionKey]: question } }]);
  }
  // Build partner profile from fetched player row
  const otherRaw = inviteeRow as Record<string, unknown>;
  const flatten = (rec: Record<string, unknown>): Record<string, unknown> => {
    const item = rec.Item ?? rec.item ?? rec.data ?? rec.record;
    return (item && typeof item === "object" && !Array.isArray(item)) ? item as Record<string, unknown> : rec;
  };
  const other = (() => { const flat = flatten(otherRaw); try { return JSON.parse(JSON.stringify(flat)) as Record<string, unknown>; } catch { return flat; } })();
  const getStr = (rec: Record<string, unknown>, ...keys: string[]): string => {
    for (const k of keys) { const v = rec[k]; if (v != null && String(v).trim() !== "") return String(v).trim(); }
    return "";
  };
  const firstStringLike = (rec: Record<string, unknown>, keyHints: string[]): string => {
    const lower = keyHints.map((h) => h.toLowerCase());
    for (const [key, value] of Object.entries(rec)) {
      if (value == null) continue;
      const v = String(value).trim(); if (!v) continue;
      const k = key.toLowerCase();
      if (lower.some((h) => k === h || k.includes(h) || h.includes(k))) return v;
    }
    return "";
  };
  const partnerProfile: Record<string, string> = {};
  const displayName = getStr(p2, "display_name", "displayName") || getStr(other, "display_name", "displayName") || getAnyKey(other, "display_name", "displayName") || firstStringLike(other, ["name", "display"]);
  if (displayName && displayName.trim() !== "") partnerProfile.display_name = displayName.trim();
  const workplace = getStr(p2, "workplace") || getStr(other, "workplace") || getAnyKey(other, "workplace");
  if (workplace) partnerProfile.workplace = workplace;
  const title = getStr(p2, "title") || getStr(other, "title") || getAnyKey(other, "title");
  if (title) partnerProfile.title = title;
  const interests = getStr(p2, "interests") || getStr(other, "interests") || getAnyKey(other, "interests");
  if (interests) partnerProfile.interests = interests;
  const email = getStr(other, "email") || getAnyKey(other, "email");
  if (email) partnerProfile.email = email;
  const phone = getStr(other, "phone") || getAnyKey(other, "phone");
  if (phone) partnerProfile.phone = phone;
  const linkedin = getStr(other, "linkedin_url", "linkedinUrl") || getAnyKey(other, "linkedin_url", "linkedinUrl");
  if (linkedin) partnerProfile.linkedin_url = linkedin;
  const website = getStr(other, "website_url", "websiteUrl") || getAnyKey(other, "website_url", "websiteUrl");
  if (website) partnerProfile.website_url = website;
  return jsonResponse(200, { question, partner_profile: partnerProfile });
}
