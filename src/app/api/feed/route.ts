import { NextResponse } from "next/server";
import { scrapeLatest } from "@/lib/scraper";
import { DEFAULT_SOURCE_IDS, SOURCES, isSourceId } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const requested = (searchParams.get("sources") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isSourceId);

  const sourceIds = requested.length > 0 ? requested : DEFAULT_SOURCE_IDS;

  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : 50;
  const forceFresh = searchParams.get("refresh") === "1";

  try {
    const { items, errors } = await scrapeLatest(sourceIds, limit, forceFresh);
    return NextResponse.json(
      {
        items,
        errors,
        sources: SOURCES,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load the news feeds.",
      },
      { status: 502 },
    );
  }
}
