import { NextResponse } from "next/server";
import { resolveArticle } from "@/lib/article";
import { buildCaption } from "@/lib/caption";
import {
  createGeneratedPostCacheKey,
  findGeneratedPost,
  storeGeneratedPost,
} from "@/lib/generated-posts";
import {
  consumeFreshGenerationQuota,
  generationRateLimitHeaders,
} from "@/lib/generation-rate-limit";
import { DEFAULT_MODEL, generateDraft } from "@/lib/openai";
import { scrapeShitposts } from "@/lib/bluesky";
import { scrapeLatest } from "@/lib/scraper";
import { coercePostSettings } from "@/lib/settings";
import { DEFAULT_SOURCE_IDS, isSourceId } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Feed lookup plus a model call; the default 10s Vercel limit is too tight. */
export const maxDuration = 60;

const MAX_EXTRA_INSTRUCTIONS = 1_000;

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

  const feedKind = payload.feedKind === "shitpost" ? "shitpost" : "news";
  const requested = Array.isArray(payload.sources)
    ? payload.sources.filter((s): s is string => typeof s === "string").filter(isSourceId)
    : [];
  const sourceIds = requested.length > 0 ? requested : DEFAULT_SOURCE_IDS;

  // Re-resolve the story from the server-side feed rather than trusting media,
  // attribution, or body text supplied by the browser.
  const { items } =
    feedKind === "shitpost"
      ? await scrapeShitposts(50)
      : await scrapeLatest(sourceIds, 50);
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

  const settings = coercePostSettings(payload.settings);
  const includeSourceUrl = payload.includeSourceUrl === true;
  const forceRegenerate = payload.forceRegenerate === true;
  const article = await resolveArticle(item);
  const articleFingerprint = createGeneratedPostCacheKey(article.text);
  const cacheKey = createGeneratedPostCacheKey({
    version: 2,
    origin: feedKind === "shitpost" ? "shitpost" : "feed",
    model: DEFAULT_MODEL,
    story: {
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      sourceName: item.sourceName,
      link: item.link,
      publishedAt: item.publishedAt,
    },
    articleFingerprint,
    articleSource: article.source,
    lengthGuide: article.lengthGuide,
    extraInstructions: extraInstructions?.trim() ?? "",
    settings,
    includeSourceUrl,
  });

  try {
    if (!forceRegenerate) {
      const cached = await findGeneratedPost(cacheKey);
      if (cached.post) {
        return NextResponse.json({
          draft: cached.post.draft,
          caption: cached.post.caption,
          item,
          model: cached.post.model,
          cached: true,
          cacheStatus: cached.status,
          inputSource: article.source,
          lengthGuide: article.lengthGuide,
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
            "Fresh-generation limit reached: 10 per hour for this IP address. Cached posts remain available.",
        },
        { status: 429, headers: generationRateLimitHeaders(quota) },
      );
    }

    const { draft, model } = await generateDraft(
      item,
      article,
      extraInstructions,
    );
    const caption = buildCaption(draft, item, settings, { includeSourceUrl });
    const cacheStatus = await storeGeneratedPost({
      cacheKey,
      // Keep the existing database enum stable; source attribution distinguishes
      // Bluesky work in the archive without requiring a production migration.
      origin: "feed",
      storyId: item.id,
      title: item.title,
      sourceName: item.sourceName,
      sourceUrl: item.link,
      imageUrl: item.imageUrl,
      caption,
      draft,
      model,
    });
    return NextResponse.json(
      {
        draft,
        caption,
        item,
        model,
        cached: false,
        cacheStatus,
        inputSource: article.source,
        lengthGuide: article.lengthGuide,
      },
      { headers: generationRateLimitHeaders(quota) },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed unexpectedly.";
    // A missing key is the admin's problem to fix; everything else is upstream.
    const status = message.includes("OPENAI_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
