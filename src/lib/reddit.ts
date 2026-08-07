import "server-only";

import { decodeEntities, htmlToText } from "./rss";
import type { ShitpostItem } from "./types";

const REDDIT_ORIGIN = "https://www.reddit.com";
const FEED_TTL_SECONDS = 3_600;
const DEFAULT_COMMUNITIES = [
  "carscirclejerk",
  "formuladank",
  "WECcirclejerk",
] as const;

interface RedditFeedResult {
  items: ShitpostItem[];
  communities: string[];
  warning?: string;
}

let lastGoodFeed: RedditFeedResult | null = null;

function configuredCommunities(): string[] {
  const configured = (process.env.REDDIT_RSS_COMMUNITIES ?? "")
    .split(",")
    .map((value) => value.trim().replace(/^r\//i, ""))
    .filter((value) => /^[A-Za-z0-9_]{2,21}$/.test(value));
  return configured.length > 0
    ? configured.slice(0, 20)
    : [...DEFAULT_COMMUNITIES];
}

function tagContent(block: string, tag: string): string | null {
  const escaped = tag.replace(/:/g, "\\:");
  const match = block.match(
    new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, "i"),
  );
  return match?.[1] ?? null;
}

function tagAttribute(
  block: string,
  tag: string,
  attribute: string,
): string | null {
  const escaped = tag.replace(/:/g, "\\:");
  const match = block.match(
    new RegExp(`<${escaped}\\s[^>]*${attribute}=["']([^"']+)["']`, "i"),
  );
  return match?.[1] ?? null;
}

function safeHttpsUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(decodeEntities(value)));
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isRedditPostUrl(url: URL): boolean {
  return (
    (url.hostname === "reddit.com" || url.hostname.endsWith(".reddit.com")) &&
    /\/comments\//.test(url.pathname)
  );
}

function isRedditImageUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "i.redd.it" ||
    hostname === "preview.redd.it" ||
    hostname === "external-preview.redd.it"
  );
}

function isRedditVideoUrl(url: URL): boolean {
  return url.hostname.toLowerCase() === "v.redd.it";
}

function mediaFromEntry(
  block: string,
  decodedContent: string,
): { imageUrl: string; mediaUrl: string; isVideoPost: boolean } | null {
  const hrefs = [...decodedContent.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => safeHttpsUrl(match[1]))
    .filter((url): url is URL => url !== null);
  const directImage = hrefs.find(isRedditImageUrl);
  const directVideo = hrefs.find(isRedditVideoUrl);
  const thumbnail = safeHttpsUrl(
    tagAttribute(block, "media:thumbnail", "url") ??
      decodedContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ??
      null,
  );
  const safeThumbnail = thumbnail && isRedditImageUrl(thumbnail) ? thumbnail : null;

  if (directImage) {
    return {
      imageUrl: (safeThumbnail ?? directImage).toString(),
      mediaUrl: directImage.toString(),
      isVideoPost: false,
    };
  }
  if (directVideo && safeThumbnail) {
    return {
      imageUrl: safeThumbnail.toString(),
      mediaUrl: safeThumbnail.toString(),
      isVideoPost: true,
    };
  }
  return safeThumbnail
    ? {
        imageUrl: safeThumbnail.toString(),
        mediaUrl: safeThumbnail.toString(),
        isVideoPost: false,
      }
    : null;
}

function subredditFromEntry(block: string): string | null {
  const category = tagAttribute(block, "category", "term")?.trim();
  return category && /^[A-Za-z0-9_]{2,21}$/.test(category) ? category : null;
}

function toShitpost(block: string): ShitpostItem | null {
  const id = htmlToText(tagContent(block, "id") ?? "");
  const title = htmlToText(tagContent(block, "title") ?? "").slice(0, 300);
  const link = safeHttpsUrl(tagAttribute(block, "link", "href"));
  const subreddit = subredditFromEntry(block);
  const rawContent = tagContent(block, "content") ?? "";
  const decodedContent = decodeEntities(decodeEntities(rawContent));
  const media = mediaFromEntry(block, decodedContent);
  if (!id || !title || !link || !isRedditPostUrl(link) || !subreddit || !media) {
    return null;
  }

  const rawAuthor = htmlToText(tagContent(block, "name") ?? "")
    .replace(/^\/?u\//i, "")
    .trim();
  const author = rawAuthor && rawAuthor !== "[deleted]" ? rawAuthor : null;
  const bodyHtml =
    decodedContent.match(/<div[^>]+class=["'][^"']*\bmd\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    "";

  return {
    id: `reddit:${id}`,
    title,
    excerpt: htmlToText(bodyHtml).slice(0, 4_000),
    link: link.toString(),
    imageUrl: media.imageUrl,
    publishedAt:
      tagContent(block, "published")?.trim() ??
      tagContent(block, "updated")?.trim() ??
      null,
    sourceId: "reddit",
    sourceName: `Reddit · r/${subreddit}`,
    author,
    categories: [subreddit, "Automotive humor"],
    contentKind: "shitpost",
    subreddit,
    isVideoPost: media.isVideoPost,
    mediaType: "image",
    mediaUrl: media.mediaUrl,
  };
}

function parseAtomFeed(xml: string): ShitpostItem[] {
  return [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)]
    .map((match) => toShitpost(match[1]))
    .filter((item): item is ShitpostItem => item !== null);
}

function balanceByCommunity(
  items: ShitpostItem[],
  communities: string[],
  limit: number,
): ShitpostItem[] {
  const queues = new Map(
    communities.map((community) => [
      community.toLowerCase(),
      items.filter(
        (item) => item.subreddit.toLowerCase() === community.toLowerCase(),
      ),
    ]),
  );
  const balanced: ShitpostItem[] = [];
  let foundItem = true;
  while (balanced.length < limit && foundItem) {
    foundItem = false;
    for (const community of communities) {
      const next = queues.get(community.toLowerCase())?.shift();
      if (!next) continue;
      balanced.push(next);
      foundItem = true;
      if (balanced.length >= limit) break;
    }
  }
  return balanced;
}

/**
 * Validate a browser-selected RSS item without another anonymous Reddit call.
 * All attribution and URLs are reconstructed from allowlisted fields.
 */
export function coerceRedditShitpost(value: unknown): ShitpostItem | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id : "";
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 300) : "";
  const excerpt =
    typeof input.excerpt === "string" ? input.excerpt.trim().slice(0, 4_000) : "";
  const subreddit = typeof input.subreddit === "string" ? input.subreddit.trim() : "";
  const author =
    typeof input.author === "string" && /^[A-Za-z0-9_-]{1,20}$/.test(input.author)
      ? input.author
      : null;
  const link = safeHttpsUrl(typeof input.link === "string" ? input.link : null);
  const imageUrl = safeHttpsUrl(
    typeof input.imageUrl === "string" ? input.imageUrl : null,
  );
  const mediaUrl = safeHttpsUrl(
    typeof input.mediaUrl === "string" ? input.mediaUrl : null,
  );
  const postId = id.match(/^reddit:t3_([a-z0-9]+)$/i)?.[1];
  const linkMatch = link?.pathname.match(
    /^\/r\/([^/]+)\/comments\/([a-z0-9]+)(?:\/|$)/i,
  );
  if (
    !postId ||
    !title ||
    !/^[A-Za-z0-9_]{2,21}$/.test(subreddit) ||
    !link ||
    !isRedditPostUrl(link) ||
    !linkMatch ||
    linkMatch[1].toLowerCase() !== subreddit.toLowerCase() ||
    linkMatch[2].toLowerCase() !== postId.toLowerCase() ||
    !imageUrl ||
    !mediaUrl ||
    !isRedditImageUrl(imageUrl) ||
    !isRedditImageUrl(mediaUrl)
  ) {
    return null;
  }

  const publishedAt =
    typeof input.publishedAt === "string" &&
    Number.isFinite(Date.parse(input.publishedAt))
      ? new Date(input.publishedAt).toISOString()
      : null;
  return {
    id,
    title,
    excerpt,
    link: link.toString(),
    imageUrl: imageUrl.toString(),
    publishedAt,
    sourceId: "reddit",
    sourceName: `Reddit · r/${subreddit}`,
    author,
    categories: [subreddit, "Automotive humor"],
    contentKind: "shitpost",
    subreddit,
    isVideoPost: input.isVideoPost === true,
    mediaType: "image",
    mediaUrl: mediaUrl.toString(),
  };
}

function redditUserAgent(): string {
  return (
    process.env.REDDIT_RSS_USER_AGENT?.trim() ||
    "SUM Editorial/1.0 (+https://newsfeed.sumracing.vn)"
  );
}

export async function scrapeShitposts(
  limit = 50,
  forceFresh = false,
): Promise<RedditFeedResult> {
  const communities = configuredCommunities();
  const url = new URL(
    `/r/${communities.map(encodeURIComponent).join("+")}/new/.rss`,
    REDDIT_ORIGIN,
  );
  url.searchParams.set("limit", "100");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/atom+xml, application/xml;q=0.9",
        "User-Agent": redditUserAgent(),
      },
      ...(forceFresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: FEED_TTL_SECONDS } }),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? "Reddit anonymous RSS is rate-limited right now. Wait about a minute and refresh."
          : `Reddit RSS returned HTTP ${response.status}.`,
      );
    }

    const items = parseAtomFeed(await response.text());
    if (items.length === 0) {
      throw new Error("Reddit RSS returned no downloadable media posts.");
    }
    const cappedLimit = Math.max(1, Math.min(Math.trunc(limit), 50));
    const result = {
      items: balanceByCommunity(items, communities, cappedLimit),
      communities,
    };
    lastGoodFeed = result;
    return result;
  } catch (error) {
    if (lastGoodFeed) {
      return {
        ...lastGoodFeed,
        items: lastGoodFeed.items.slice(
          0,
          Math.max(1, Math.min(Math.trunc(limit), 50)),
        ),
        warning:
          "Reddit blocked the fresh RSS request, so this is the last successful feed from this server.",
      };
    }
    throw error;
  }
}
