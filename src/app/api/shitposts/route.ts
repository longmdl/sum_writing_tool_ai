import { NextResponse } from "next/server";
import { scrapeShitposts } from "@/lib/bluesky";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 50)
    : 50;

  try {
    const result = await scrapeShitposts(
      limit,
      searchParams.get("refresh") === "1",
    );
    return NextResponse.json(
      { ...result, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the Bluesky feed.",
      },
      { status: 502 },
    );
  }
}
