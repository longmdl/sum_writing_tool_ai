import { NextResponse } from "next/server";
import {
  deleteGeneratedPost,
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const id =
    payload && typeof payload === "object" && "id" in payload
      ? (payload as { id?: unknown }).id
      : null;

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "A valid generated post id is required." },
      { status: 400 },
    );
  }

  const result = await deleteGeneratedPost(id);

  if (result.status === "unavailable") {
    return NextResponse.json(
      { error: "Generated-post storage is not configured." },
      { status: 503 },
    );
  }
  if (result.status === "error") {
    return NextResponse.json(
      { error: "The cached post could not be deleted." },
      { status: 502 },
    );
  }
  if (result.status === "not_found") {
    return NextResponse.json(
      { error: "That cached post no longer exists." },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true, id });
}
