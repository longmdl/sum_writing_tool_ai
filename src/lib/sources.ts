import type { Source, SourceId } from "./types";

/**
 * Source registry.
 *
 * `policy` records what each publisher's robots.txt said when this file was
 * written (checked 2026-07-27). Two publishers set
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
