import { parseRss, decodeEntities } from "./rss";
import { SOURCES, SOURCE_BY_ID } from "./sources";
import type { NewsItem, Source, SourceId } from "./types";

const USER_AGENT =
  "SUMWritingTool/1.0 (+Facebook editorial assistant; summarises and links back to source)";

/** Feeds refresh often during a race weekend; five minutes is a fair cadence. */
const FEED_TTL_SECONDS = 300;
/** Article pages are immutable once published. */
const ARTICLE_TTL_SECONDS = 86_400;

const ENRICH_CONCURRENCY = 5;

export interface ScrapeResult {
  items: NewsItem[];
  errors: { sourceId: SourceId; sourceName: string; message: string }[];
}

async function fetchText(
  url: string,
  revalidate: number,
  forceFresh = false,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9",
    },
    ...(forceFresh
      ? { cache: "no-store" as const }
      : { next: { revalidate } }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

/** Drops utm_* and similar, so the link we publish is the clean canonical one. */
function cleanLink(link: string): string {
  try {
    const url = new URL(link);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "source") {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return link;
  }
}

function toIso(pubDate: string | null): string | null {
  if (!pubDate) return null;
  const parsed = new Date(pubDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function metaContent(html: string, property: string): string | null {
  // Attribute order varies, so try content-last and content-first.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

/**
 * formula1.com's feed carries no pubDate and no image, so the article page is
 * the only place to get them. We read two meta tags and nothing else — the
 * article body is never taken.
 */
async function enrich(item: NewsItem): Promise<NewsItem> {
  try {
    const html = await fetchText(item.link, ARTICLE_TTL_SECONDS);
    const published =
      metaContent(html, "article:published_time") ??
      html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ??
      null;

    return {
      ...item,
      imageUrl: item.imageUrl ?? metaContent(html, "og:image"),
      publishedAt: item.publishedAt ?? toIso(published),
    };
  } catch {
    // An article that will not load is not fatal; it just sorts without a date.
    return item;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await fn(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function loadSource(
  source: Source,
  forceFresh: boolean,
): Promise<NewsItem[]> {
  const xml = await fetchText(source.feedUrl, FEED_TTL_SECONDS, forceFresh);
  const raw = parseRss(xml);
  if (raw.length === 0) {
    throw new Error("Feed returned no readable items");
  }

  const items: NewsItem[] = raw
    .filter((entry) => entry.title && entry.link)
    .map((entry) => {
      const link = cleanLink(entry.link);
      return {
        id: `${source.id}:${entry.guid || link}`,
        title: entry.title,
        excerpt: entry.description,
        link,
        imageUrl: entry.imageUrl,
        publishedAt: toIso(entry.pubDate),
        sourceId: source.id,
        sourceName: source.name,
        author: entry.author,
        categories: entry.categories,
      };
    });
  if (items.length === 0) {
    throw new Error("Feed returned no readable items");
  }

  if (!source.needsEnrichment) return items;
  return mapWithConcurrency(items, ENRICH_CONCURRENCY, enrich);
}

/** Same story from two outlets should occupy one slot, not two. */
function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SOURCE_PRIORITY = new Map(SOURCES.map((s, index) => [s.id, index]));

export async function scrapeLatest(
  sourceIds: SourceId[],
  limit = 25,
  forceFresh = false,
): Promise<ScrapeResult> {
  const sources = sourceIds
    .map((id) => SOURCE_BY_ID.get(id))
    .filter((s): s is Source => Boolean(s));

  const settled = await Promise.allSettled(
    sources.map((source) => loadSource(source, forceFresh)),
  );

  const errors: ScrapeResult["errors"] = [];
  const collected: NewsItem[] = [];

  settled.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      collected.push(...result.value);
    } else {
      errors.push({
        sourceId: source.id,
        sourceName: source.name,
        message: result.reason instanceof Error ? result.reason.message : "Feed unavailable",
      });
    }
  });

  const byTitle = new Map<string, NewsItem>();
  for (const item of collected) {
    const key = normaliseTitle(item.title);
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, item);
      continue;
    }
    const incomingRank = SOURCE_PRIORITY.get(item.sourceId) ?? 99;
    const existingRank = SOURCE_PRIORITY.get(existing.sourceId) ?? 99;
    if (incomingRank < existingRank) byTitle.set(key, item);
  }

  const items = [...byTitle.values()]
    .sort((a, b) => {
      // Undated items sort last rather than pretending to be from 1970.
      const at = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
      return bt - at;
    })
    .slice(0, limit);

  return { items, errors };
}
