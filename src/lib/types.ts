export type SourceId = "formula1" | "motorsport" | "traxion" | "racefans";

/**
 * What the publisher's robots.txt says about AI use. Surfaced in the UI so an
 * admin enabling a source can see what they are agreeing to.
 */
export interface SourcePolicy {
  /** Verbatim Content-Signal line, or null if the publisher sets none. */
  contentSignal: string | null;
  /** True when robots.txt Disallows named AI crawlers (GPTBot, ClaudeBot, ...). */
  blocksAiCrawlers: boolean;
  /** Plain-language summary shown next to the source toggle. */
  note: string;
}

export interface Source {
  id: SourceId;
  name: string;
  feedUrl: string;
  homepage: string;
  /** Enabled by default only for sources that place no restriction on AI use. */
  defaultEnabled: boolean;
  /**
   * formula1.com's feed omits pubDate and images, so each item needs one extra
   * fetch of the article page to read og:image and datePublished.
   */
  needsEnrichment: boolean;
  policy: SourcePolicy;
}

export interface NewsItem {
  id: string;
  title: string;
  /** Publisher's own RSS excerpt. Never the full article body. */
  excerpt: string;
  link: string;
  imageUrl: string | null;
  publishedAt: string | null;
  sourceId: SourceId;
  sourceName: string;
  author: string | null;
  categories: string[];
}

/** The only fields the model is allowed to write. */
export interface DraftContent {
  headline: string;
  lead: string;
  body: string[];
  list?: { label: string; items: string[] };
  closingQuestion: string;
}

/** Footer values the app assembles deterministically. */
export interface PostSettings {
  author: string;
  hashtags: string;
  discordLine: string;
  ctaLine: string;
}

export interface GenerateResponse {
  draft: DraftContent;
  caption: string;
  item: NewsItem;
  model: string;
}
