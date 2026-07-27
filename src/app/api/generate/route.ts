import { NextResponse } from "next/server";
import { buildCaption, DEFAULT_SETTINGS } from "@/lib/caption";
import { generateDraft } from "@/lib/openai";
import { scrapeLatest } from "@/lib/scraper";
import { DEFAULT_SOURCE_IDS, isSourceId } from "@/lib/sources";
import type { PostSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Feed lookup plus a model call; the default 10s Vercel limit is too tight. */
export const maxDuration = 60;

const MAX_EXTRA_INSTRUCTIONS = 1_000;

function coerceSettings(raw: unknown): PostSettings {
  const input = (raw ?? {}) as Partial<Record<keyof PostSettings, unknown>>;
  const pick = (key: keyof PostSettings) =>
    typeof input[key] === "string" ? (input[key] as string) : DEFAULT_SETTINGS[key];

  return {
    author: pick("author").slice(0, 120),
    hashtags: pick("hashtags").slice(0, 300),
    discordLine: pick("discordLine").slice(0, 300),
    ctaLine: pick("ctaLine").slice(0, 200),
  };
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) {
    return NextResponse.json(
      { error: "Missing `id` — pick a story from the feed first." },
      { status: 400 },
    );
  }

  const requested = Array.isArray(payload.sources)
    ? payload.sources.filter((s): s is string => typeof s === "string").filter(isSourceId)
    : [];
  const sourceIds = requested.length > 0 ? requested : DEFAULT_SOURCE_IDS;

  // Re-resolve the story from the (cached) feed rather than trusting the client.
  // This keeps the endpoint from being used to summarise arbitrary text, and
  // guarantees the attribution matches a source the admin actually enabled.
  const { items } = await scrapeLatest(sourceIds, 25);
  const item = items.find((candidate) => candidate.id === id);

  if (!item) {
    return NextResponse.json(
      { error: "That story is no longer in the feed. Refresh and try again." },
      { status: 404 },
    );
  }

  const extraInstructions =
    typeof payload.extraInstructions === "string"
      ? payload.extraInstructions.slice(0, MAX_EXTRA_INSTRUCTIONS)
      : undefined;

  const settings = coerceSettings(payload.settings);
  const includeSourceUrl = payload.includeSourceUrl === true;

  try {
    const { draft, model } = await generateDraft(item, extraInstructions);
    const caption = buildCaption(draft, item, settings, { includeSourceUrl });
    return NextResponse.json({ draft, caption, item, model });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed unexpectedly.";
    // A missing key is the admin's problem to fix; everything else is upstream.
    const status = message.includes("OPENAI_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
