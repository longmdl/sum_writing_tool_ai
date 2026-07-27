export type SourceId =
  | "formula1"
  | "motorsport"
  | "traxion"
  | "racefans"
  | "motogp"
  | "wec"
  | "gt"
  | "imsa"
  | "gtwc";

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
  /** Compact label used in the source picker; attribution always uses `name`. */
  shortName?: string;
  feedUrl: string;
  homepage: string;
  /** Whether this feed is included in the default editorial queue. */
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

/** Topic tags that open a post. Free-form so the guide can add more. */
export const HEADER_TAGS = [
  "F1 NEWS",
  "F1 RACE RECAP",
  "SIM RACING NEWS",
  "WEC NEWS",
  "IMSA NEWS",
  "MOTOGP NEWS",
  "VĂN HÓA XE",
  "🚨 BREAKING",
] as const;

/** The only fields the model is allowed to write. */
export interface DraftContent {
  headerTag: string;
  body: string[];
  list?: string[];
  hook?: string;
  topicHashtags: string[];
}

/** Footer values the app assembles deterministically. */
export interface PostSettings {
  author: string;
  /** The four core tags, always prepended to the model's topic tags. */
  coreHashtags: string;
  discordLine: string;
  ctaLine: string;
  /** Both are in the house style; pick one and stay consistent. */
  divider: "em-dash" | "underscore";
}

export interface GenerateResponse {
  draft: DraftContent;
  caption: string;
  item: NewsItem;
  model: string;
}
