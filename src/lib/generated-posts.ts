import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DraftContent } from "./types";

export const GENERATED_POST_RETENTION_DAYS = 30;

export type GeneratedPostOrigin = "feed" | "manual";
export type CacheOperationStatus =
  | "hit"
  | "miss"
  | "stored"
  | "unavailable"
  | "error";

export interface GeneratedPostRecord {
  id: string;
  cacheKey: string;
  origin: GeneratedPostOrigin;
  storyId: string | null;
  title: string;
  sourceName: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  caption: string;
  draft: DraftContent;
  model: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface GeneratedPostInput {
  cacheKey: string;
  origin: GeneratedPostOrigin;
  storyId?: string | null;
  title: string;
  sourceName: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  caption: string;
  draft: DraftContent;
  model?: string | null;
}

interface GeneratedPostRow {
  id: string;
  cache_key: string;
  origin: GeneratedPostOrigin;
  story_id: string | null;
  title: string;
  source_name: string;
  source_url: string | null;
  image_url: string | null;
  caption: string;
  draft: DraftContent;
  model: string | null;
  created_at: string;
  expires_at: string;
}

const GENERATED_POST_COLUMNS = [
  "id",
  "cache_key",
  "origin",
  "story_id",
  "title",
  "source_name",
  "source_url",
  "image_url",
  "caption",
  "draft",
  "model",
  "created_at",
  "expires_at",
].join(",");

let databaseClient: SupabaseClient | null = null;

function stableJson(value: unknown): string {
  if (value === undefined) return '"__undefined__"';
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createGeneratedPostCacheKey(input: unknown): string {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}

function getDatabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) return null;

  databaseClient ??= createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return databaseClient;
}

function toGeneratedPost(row: GeneratedPostRow): GeneratedPostRecord {
  return {
    id: row.id,
    cacheKey: row.cache_key,
    origin: row.origin,
    storyId: row.story_id,
    title: row.title,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
    caption: row.caption,
    draft: row.draft,
    model: row.model,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function findGeneratedPost(
  cacheKey: string,
): Promise<{
  post: GeneratedPostRecord | null;
  status: CacheOperationStatus;
}> {
  const client = getDatabaseClient();
  if (!client) return { post: null, status: "unavailable" };

  const { data, error } = await client
    .from("generated_posts")
    .select(GENERATED_POST_COLUMNS)
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Generated-post cache lookup failed:", error.message);
    return { post: null, status: "error" };
  }

  return data
    ? {
        post: toGeneratedPost(data as unknown as GeneratedPostRow),
        status: "hit",
      }
    : { post: null, status: "miss" };
}

export async function storeGeneratedPost(
  input: GeneratedPostInput,
): Promise<CacheOperationStatus> {
  const client = getDatabaseClient();
  if (!client) return "unavailable";

  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + GENERATED_POST_RETENTION_DAYS);

  const { error } = await client.from("generated_posts").upsert(
    {
      cache_key: input.cacheKey,
      origin: input.origin,
      story_id: input.storyId ?? null,
      title: input.title,
      source_name: input.sourceName,
      source_url: input.sourceUrl ?? null,
      image_url: input.imageUrl ?? null,
      caption: input.caption,
      draft: input.draft,
      model: input.model ?? null,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "cache_key" },
  );

  if (error) {
    console.error("Generated-post cache write failed:", error.message);
    return "error";
  }
  return "stored";
}

export async function listGeneratedPosts(
  limit = 100,
): Promise<{
  posts: GeneratedPostRecord[];
  status: CacheOperationStatus;
}> {
  const client = getDatabaseClient();
  if (!client) return { posts: [], status: "unavailable" };

  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
  const { data, error } = await client
    .from("generated_posts")
    .select(GENERATED_POST_COLUMNS)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("Generated-post archive lookup failed:", error.message);
    return { posts: [], status: "error" };
  }

  return {
    posts: ((data ?? []) as unknown as GeneratedPostRow[]).map(toGeneratedPost),
    status: "hit",
  };
}
