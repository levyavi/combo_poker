export type LambdaEvent = {
  httpMethod: string;
  path?: string;
  rawPath?: string;
  body?: string | Record<string, unknown> | null;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
};

export type LambdaResponse = {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
};

export const EVENTS_TABLE = "events";
export const PLAYERS_TABLE = "players";
export const DECKS_TABLE = "decks";
export const COMBO_SESSIONS_TABLE = "combo_sessions";
export const INTERACTION_EDGES_TABLE = "interaction_edges";

export const DEFAULT_LLM_INSTRUCTIONS = `Generate short, friendly questions, that help two people at a networking event discover common interests. The question should attempt to relate to the person asking and the person being asked.

Information about the person asking: {{asking}}
Information about the person being asked: {{asked}}`;
