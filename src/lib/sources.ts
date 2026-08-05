import type { Source, SourceId } from "./types";

/**
 * Source registry.
 *
 * `policy` records what each publisher's robots.txt said when this file was
 * written (checked 2026-08-05). Two publishers set
 * `Content-Signal: ai-train=no, use=reference` and disallow named training
 * crawlers. This tool performs reference use only and always links back.
 *
 * Re-check these values periodically; publishers change them.
 */
export const SOURCES: Source[] = [
  {
    id: "formula1",
    name: "Formula 1",
    feedUrl: "https://www.formula1.com/en/latest/all.xml",
    homepage: "https://www.formula1.com",
    defaultEnabled: true,
    needsEnrichment: true,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "Official F1 feed. No AI restrictions in robots.txt.",
    },
  },
  {
    id: "motorsport",
    name: "Motorsport.com",
    feedUrl: "https://www.motorsport.com/rss/f1/news/",
    homepage: "https://www.motorsport.com",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "No AI restrictions in robots.txt. Feed carries dates and images.",
    },
  },
  {
    id: "traxion",
    name: "Traxion.GG",
    feedUrl: "https://traxion.gg/feed/",
    homepage: "https://traxion.gg",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: "search=yes, ai-train=no, use=reference",
      blocksAiCrawlers: true,
      note: "Sim racing and motorsport. Permits reference use; forbids AI training. Always credited.",
    },
  },
  {
    id: "racefans",
    name: "RaceFans",
    feedUrl: "https://www.racefans.net/feed/",
    homepage: "https://www.racefans.net",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: "search=yes, ai-train=no, use=reference",
      blocksAiCrawlers: true,
      note: "Independent F1 coverage. Permits reference use; forbids AI training. Always credited.",
    },
  },
  {
    id: "crash",
    name: "Crash.net",
    feedUrl: "https://www.crash.net/rss/f1",
    homepage: "https://www.crash.net/f1",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "Public F1 RSS feed with publisher attribution.",
    },
  },
  {
    id: "therace",
    name: "The Race",
    feedUrl: "https://www.the-race.com/rss/",
    homepage: "https://www.the-race.com/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "Independent multi-series motorsport RSS feed.",
    },
  },
  {
    id: "motorsportweek",
    name: "Motorsport Week",
    shortName: "MS Week",
    feedUrl: "https://www.motorsportweek.com/feed/",
    homepage: "https://www.motorsportweek.com/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "Multi-series motorsport RSS feed with publisher attribution.",
    },
  },
  {
    id: "motogp",
    name: "Motorsport.com MotoGP",
    shortName: "MotoGP",
    feedUrl: "https://www.motorsport.com/rss/motogp/news/",
    homepage: "https://www.motorsport.com/motogp/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "MotoGP category feed. Public RSS with publisher attribution.",
    },
  },
  {
    id: "wec",
    name: "Motorsport.com WEC",
    shortName: "WEC",
    feedUrl: "https://www.motorsport.com/rss/wec/news/",
    homepage: "https://www.motorsport.com/wec/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "World Endurance Championship category feed. Public RSS with publisher attribution.",
    },
  },
  {
    id: "gt",
    name: "Motorsport.com GT",
    shortName: "GT Racing",
    feedUrl: "https://www.motorsport.com/rss/gt/news/",
    homepage: "https://www.motorsport.com/gt/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "International GT racing category feed. Public RSS with publisher attribution.",
    },
  },
  {
    id: "imsa",
    name: "Motorsport.com IMSA",
    shortName: "IMSA",
    feedUrl: "https://www.motorsport.com/rss/imsa/news/",
    homepage: "https://www.motorsport.com/imsa/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "IMSA category feed. Public RSS with publisher attribution.",
    },
  },
  {
    id: "gtwc",
    name: "GT World Challenge",
    shortName: "GTWC",
    feedUrl: "https://www.gt-world-challenge-europe.com/feed/",
    homepage: "https://www.gt-world-challenge-europe.com/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "Official GT World Challenge Europe public RSS feed.",
    },
  },
  {
    id: "sportscar365",
    name: "Sportscar365",
    shortName: "SC365",
    feedUrl: "https://sportscar365.com/feed/",
    homepage: "https://sportscar365.com/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "Endurance and GT racing RSS feed with publisher attribution.",
    },
  },
  {
    id: "dirtfish",
    name: "DirtFish",
    feedUrl: "https://dirtfish.com/feed/",
    homepage: "https://dirtfish.com/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "Rally and WRC RSS feed with publisher attribution.",
    },
  },
  {
    id: "racer",
    name: "RACER",
    feedUrl: "https://racer.com/feed/",
    homepage: "https://racer.com/",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "US and international motorsport RSS feed with publisher attribution.",
    },
  },
  {
    id: "fia",
    name: "FIA",
    feedUrl: "https://www.fia.com/rss/news",
    homepage: "https://www.fia.com/news",
    defaultEnabled: true,
    needsEnrichment: false,
    policy: {
      contentSignal: null,
      blocksAiCrawlers: false,
      note: "Official FIA news RSS feed.",
    },
  },
];

export const SOURCE_BY_ID = new Map<SourceId, Source>(
  SOURCES.map((s) => [s.id, s]),
);

export const DEFAULT_SOURCE_IDS = SOURCES.filter((s) => s.defaultEnabled).map(
  (s) => s.id,
);

export function isSourceId(value: string): value is SourceId {
  return SOURCE_BY_ID.has(value as SourceId);
}
