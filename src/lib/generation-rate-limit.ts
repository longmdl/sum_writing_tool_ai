import "server-only";

import { createHmac } from "node:crypto";
import { getServerDatabaseClient } from "./generated-posts";

export const FRESH_GENERATION_LIMIT = 10;
export const FRESH_GENERATION_WINDOW_SECONDS = 60 * 60;

export type GenerationRateLimitDecision =
  | {
      status: "allowed" | "limited";
      remaining: number;
      resetAt: string;
    }
  | { status: "unavailable" };

interface GenerationRateLimitRow {
  allowed: boolean;
  remaining: number;
  reset_at: string;
}

function requestIp(request: Request): string {
  const forwarded = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for") ??
      request.headers.get("x-forwarded-for")
    : request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip");

  const first = forwarded?.split(",", 1)[0]?.trim();
  return first?.slice(0, 128) || "unknown";
}

function hashIp(ip: string): string | null {
  const secret =
    process.env.RATE_LIMIT_HASH_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function generationRateLimitHeaders(
  decision: Exclude<GenerationRateLimitDecision, { status: "unavailable" }>,
): HeadersInit {
  const resetSeconds = Math.max(
    0,
    Math.ceil((Date.parse(decision.resetAt) - Date.now()) / 1_000),
  );

  return {
    "RateLimit-Limit": String(FRESH_GENERATION_LIMIT),
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(resetSeconds),
    "X-RateLimit-Limit": String(FRESH_GENERATION_LIMIT),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": decision.resetAt,
    ...(decision.status === "limited"
      ? { "Retry-After": String(Math.max(1, resetSeconds)) }
      : {}),
  };
}

export async function consumeFreshGenerationQuota(
  request: Request,
): Promise<GenerationRateLimitDecision> {
  const client = getServerDatabaseClient();
  const ipHash = hashIp(requestIp(request));
  if (!client || !ipHash) return { status: "unavailable" };

  const { data, error } = await client.rpc("consume_generation_rate_limit", {
    p_ip_hash: ipHash,
    p_limit: FRESH_GENERATION_LIMIT,
    p_window_seconds: FRESH_GENERATION_WINDOW_SECONDS,
  });

  if (error) {
    console.error("Generation rate-limit lookup failed:", error.message);
    return { status: "unavailable" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | GenerationRateLimitRow
    | null;
  if (
    !row ||
    typeof row.allowed !== "boolean" ||
    typeof row.remaining !== "number" ||
    typeof row.reset_at !== "string"
  ) {
    console.error("Generation rate-limit lookup returned an invalid result.");
    return { status: "unavailable" };
  }

  return {
    status: row.allowed ? "allowed" : "limited",
    remaining: Math.max(0, row.remaining),
    resetAt: row.reset_at,
  };
}
