import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

function isAllowedRedditMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      ["redd.it", "redditmedia.com"].some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      )
    );
  } catch {
    return false;
  }
}

function safeFilename(requested: string, contentType: string): string {
  const fallbackExtension =
    {
      "image/avif": ".avif",
      "image/gif": ".gif",
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
    }[contentType] ?? (contentType.startsWith("video/") ? ".mp4" : ".jpg");
  const cleaned = requested
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  const base = cleaned || "reddit-media";
  return /\.[a-zA-Z0-9]{2,5}$/.test(base) ? base : `${base}${fallbackExtension}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mediaUrl = searchParams.get("url") ?? "";
  if (!isAllowedRedditMediaUrl(mediaUrl)) {
    return NextResponse.json({ error: "Unsupported media URL." }, { status: 400 });
  }

  try {
    const upstream = await fetch(mediaUrl, {
      headers: {
        Accept: "image/*,video/*",
        "User-Agent":
          process.env.REDDIT_RSS_USER_AGENT?.trim() ||
          "SUM Editorial/1.0 (+https://newsfeed.sumracing.vn)",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!upstream.ok || !upstream.body) {
      throw new Error(`Media host returned HTTP ${upstream.status}`);
    }
    if (!isAllowedRedditMediaUrl(upstream.url)) {
      throw new Error("Media redirected to an unsupported host.");
    }

    const contentType = (upstream.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      throw new Error("The URL did not return an image or video.");
    }
    const contentLength = Number(upstream.headers.get("content-length") ?? 0);
    if (contentLength > MAX_MEDIA_BYTES) {
      return NextResponse.json(
        { error: "Media is larger than the 100 MB download limit." },
        { status: 413 },
      );
    }

    const filename = safeFilename(
      searchParams.get("filename") ?? "reddit-media",
      contentType,
    );
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not download media.",
      },
      { status: 502 },
    );
  }
}
