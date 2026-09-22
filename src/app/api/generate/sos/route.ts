import { NextResponse } from "next/server";
import {
  createGeneratedPostCacheKey,
  findGeneratedPost,
  storeGeneratedPost,
} from "@/lib/generated-posts";
import {
  consumeFreshGenerationQuota,
  generationRateLimitHeaders,
} from "@/lib/generation-rate-limit";
import { DEFAULT_MODEL, generateSosCaption } from "@/lib/openai";
import type { DraftContent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_CONTEXT_CHARS = 10;
const MAX_CONTEXT_CHARS = 12_000;
const SOS_SOURCE_NAME = "SUM Open Series";

function contextTitle(context: string): string {
  const compact = context.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}…` : compact;
}

function archiveDraft(caption: string): DraftContent {
  const lines = caption
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hashtagLine = lines.find((line) => line.startsWith("#")) ?? "";
  const topicHashtags = hashtagLine
    .split(/\s+/)
    .filter((value) => value.startsWith("#"));
  const body = lines.filter(
    (line, index) =>
      index > 0 &&
      line !== "——————" &&
      !line.startsWith("#") &&
      line !== "Tham gia CLB ngay hôm nay",
  );

  return {
    headerTag: lines[0] ?? "GT3 OPEN SERIES",
    body: body.length > 0 ? body : [caption],
    topicHashtags,
  };
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const context =
    typeof payload.context === "string" ? payload.context.trim() : "";
  if (context.length < MIN_CONTEXT_CHARS) {
    return NextResponse.json(
      { error: `Add at least ${MIN_CONTEXT_CHARS} characters of SOS context.` },
      { status: 400 },
    );
  }
  if (context.length > MAX_CONTEXT_CHARS) {
    return NextResponse.json(
      { error: `SOS context cannot exceed ${MAX_CONTEXT_CHARS.toLocaleString()} characters.` },
      { status: 400 },
    );
  }

  const forceRegenerate = payload.forceRegenerate === true;
  const cacheKey = createGeneratedPostCacheKey({
    version: 1,
    origin: "sos",
    model: DEFAULT_MODEL,
    context,
  });

  try {
    if (!forceRegenerate) {
      const cached = await findGeneratedPost(cacheKey);
      if (cached.post) {
        return NextResponse.json({
          caption: cached.post.caption,
          model: cached.post.model,
          cached: true,
          cacheStatus: cached.status,
        });
      }
    }

    const quota = await consumeFreshGenerationQuota(request);
    if (quota.status === "unavailable") {
      return NextResponse.json(
        { error: "Generation protection is temporarily unavailable. Try again shortly." },
        { status: 503 },
      );
    }
    if (quota.status === "limited") {
      return NextResponse.json(
        {
          error:
            "Fresh-generation limit reached: 10 per hour for this IP address. Cached captions remain available.",
        },
        { status: 429, headers: generationRateLimitHeaders(quota) },
      );
    }

    const result = await generateSosCaption({ context });
    const cacheStatus = await storeGeneratedPost({
      cacheKey,
      origin: "manual",
      title: contextTitle(context),
      sourceName: SOS_SOURCE_NAME,
      caption: result.caption,
      draft: archiveDraft(result.caption),
      model: result.model,
    });

    return NextResponse.json(
      {
        caption: result.caption,
        model: result.model,
        cached: false,
        cacheStatus,
      },
      { headers: generationRateLimitHeaders(quota) },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SOS generation failed unexpectedly.";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
