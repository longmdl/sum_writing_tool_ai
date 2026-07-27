import { NextResponse } from "next/server";
import {
  GENERATED_POST_RETENTION_DAYS,
  listGeneratedPosts,
} from "@/lib/generated-posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100;
  const result = await listGeneratedPosts(limit);

  return NextResponse.json({
    ...result,
    retentionDays: GENERATED_POST_RETENTION_DAYS,
  });
}
