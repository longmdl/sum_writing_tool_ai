import "server-only";

import type { ShitpostItem } from "./types";

const SEARCH_ENDPOINT = "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const BLOB_ENDPOINT = "https://bsky.social/xrpc/com.atproto.sync.getBlob";
const FEED_TTL_SECONDS = 300;
const SEARCH_WINDOW_DAYS = 60;
const DEFAULT_QUERIES = [
  "#carmemes",
  "#f1memes",
  "#carhumor",
  "Formula One meme",
  "MotoGP meme",
  "WEC meme",
] as const;

interface BlueskyAuthor {
  did?: string;
  handle?: string;
  displayName?: string;
  labels?: Array<{ val?: string }>;
}

interface BlueskyRecord {
  text?: string;
  createdAt?: string;
  reply?: unknown;
}

interface BlueskyImageView {
  thumb?: string;
  fullsize?: string;
  alt?: string;
}

interface BlueskyEmbedView {
  $type?: string;
  images?: BlueskyImageView[];
  cid?: string;
  thumbnail?: string;
}

interface BlueskyPost {
  uri?: string;
  author?: BlueskyAuthor;
  record?: BlueskyRecord;
  embed?: BlueskyEmbedView;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  quoteCount?: number;
  indexedAt?: string;
  labels?: Array<{ val?: string }>;
}

interface BlueskySearchResponse {
  posts?: BlueskyPost[];
}

const UNSAFE_LABELS = new Set([
  "porn",
  "sexual",
  "nudity",
  "graphic-media",
  "!no-unauthenticated",
]);

function configuredQueries(): string[] {
  const configured = (process.env.BLUESKY_MEME_QUERIES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length >= 2 && value.length <= 100);
  return configured.length > 0 ? configured.slice(0, 10) : [...DEFAULT_QUERIES];
}

function safeHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hasUnsafeLabel(post: BlueskyPost): boolean {
  return [...(post.labels ?? []), ...(post.author?.labels ?? [])].some((label) =>
    UNSAFE_LABELS.has(label.val ?? ""),
  );
}

function engagementScore(post: BlueskyPost): number {
  return Math.round(
    Math.max(0, post.likeCount ?? 0) +
      Math.max(0, post.repostCount ?? 0) * 2 +
      Math.max(0, post.quoteCount ?? 0) * 1.5 +
      Math.max(0, post.replyCount ?? 0) * 0.5,
  );
}

function mediaFromPost(
  post: BlueskyPost,
): { mediaType: "image" | "video"; mediaUrl: string; imageUrl: string | null; alt: string } | null {
  const embed = post.embed;
  if (!embed) return null;

  const firstImage = embed.images?.[0];
  const imageUrl = safeHttpsUrl(firstImage?.fullsize);
  if (imageUrl) {
    return {
      mediaType: "image",
      mediaUrl: imageUrl,
      imageUrl,
      alt: firstImage?.alt?.trim() ?? "",
    };
  }

  const isVideo = embed.$type?.includes("video");
  const did = post.author?.did;
  const cid = embed.cid;
  if (!isVideo || !did || !cid) return null;
  const blobUrl = new URL(BLOB_ENDPOINT);
  blobUrl.searchParams.set("did", did);
  blobUrl.searchParams.set("cid", cid);
  return {
    mediaType: "video",
    mediaUrl: blobUrl.toString(),
    imageUrl: safeHttpsUrl(embed.thumbnail),
    alt: "",
  };
}

function toShitpost(post: BlueskyPost, query: string): ShitpostItem | null {
  const handle = post.author?.handle?.trim();
  const uri = post.uri;
  if (!handle || !uri || post.record?.reply || hasUnsafeLabel(post)) return null;

  const rkey = uri.split("/").at(-1);
  if (!rkey) return null;
  const media = mediaFromPost(post);
  if (!media) return null;

  const postText = post.record?.text?.trim() ?? "";
  const title = (postText || media.alt || `Media post by @${handle}`).slice(0, 300);
  const excerpt = [postText, media.alt && media.alt !== postText ? media.alt : ""]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4_000);
  const displayName = post.author?.displayName?.trim() || null;

  return {
    id: `bluesky:${uri}`,
    title,
    excerpt,
    link: `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(rkey)}`,
    imageUrl: media.imageUrl,
    publishedAt: post.record?.createdAt ?? post.indexedAt ?? null,
    sourceId: "bluesky",
    sourceName: `Bluesky · @${handle}`,
    author: displayName,
    categories: [query, "Automotive humor"],
    contentKind: "shitpost",
    authorHandle: handle,
    likeCount: Math.max(0, Math.trunc(post.likeCount ?? 0)),
    repostCount: Math.max(0, Math.trunc(post.repostCount ?? 0)),
    score: engagementScore(post),
    commentCount: Math.max(0, Math.trunc(post.replyCount ?? 0)),
    mediaType: media.mediaType,
    mediaUrl: media.mediaUrl,
  };
}

async function searchQuery(query: string, forceFresh: boolean): Promise<ShitpostItem[]> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "top");
  url.searchParams.set("limit", "50");
  url.searchParams.set(
    "since",
    new Date(Date.now() - SEARCH_WINDOW_DAYS * 86_400_000).toISOString(),
  );

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    ...(forceFresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: FEED_TTL_SECONDS } }),
  });
  if (!response.ok) {
    throw new Error(`Bluesky search returned HTTP ${response.status}`);
  }
  const data = (await response.json()) as BlueskySearchResponse;
  return (data.posts ?? [])
    .map((post) => toShitpost(post, query))
    .filter((item): item is ShitpostItem => item !== null);
}

export async function scrapeShitposts(
  limit = 50,
  forceFresh = false,
): Promise<{ items: ShitpostItem[]; queries: string[] }> {
  const queries = configuredQueries();
  const results = await Promise.allSettled(
    queries.map((query) => searchQuery(query, forceFresh)),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length === results.length) {
    const firstFailure = failures[0] as PromiseRejectedResult | undefined;
    throw firstFailure?.reason instanceof Error
      ? firstFailure.reason
      : new Error("Bluesky searches failed.");
  }

  const seen = new Set<string>();
  const items = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((left, right) => right.score - left.score)
    .filter((item) => {
      const key = item.mediaUrl;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, Math.min(Math.trunc(limit), 50)));

  return { items, queries };
}
