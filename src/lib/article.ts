import { Readability } from "@mozilla/readability";
import { DOMParser } from "linkedom";
import type {
  ArticleInputSource,
  ArticleLengthGuide,
  FeedItem,
} from "./types";
import { isShitpostItem } from "./types";

const USER_AGENT =
  "SUMWritingTool/1.0 (+Facebook editorial assistant; summarises and links back to source)";
const ARTICLE_TTL_SECONDS = 86_400;
const ARTICLE_TIMEOUT_MS = 12_000;
const MIN_ARTICLE_CHARS = 400;
const MAX_ARTICLE_CHARS = 60_000;

export interface ResolvedArticle {
  text: string;
  source: ArticleInputSource;
  lengthGuide: ArticleLengthGuide;
}

function normaliseText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_ARTICLE_CHARS);
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export function getArticleLengthGuide(text: string): ArticleLengthGuide {
  const sourceWords = wordCount(text);

  if (sourceWords < 250) {
    return { sourceWords, minBodyWords: 70, maxBodyWords: 120 };
  }
  if (sourceWords < 600) {
    return { sourceWords, minBodyWords: 120, maxBodyWords: 200 };
  }
  if (sourceWords < 1_200) {
    return { sourceWords, minBodyWords: 180, maxBodyWords: 300 };
  }
  if (sourceWords < 2_000) {
    return { sourceWords, minBodyWords: 250, maxBodyWords: 380 };
  }
  return { sourceWords, minBodyWords: 320, maxBodyWords: 450 };
}

function findArticleBody(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const match = findArticleBody(entry);
      if (match) return match;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.articleBody === "string" &&
    record.articleBody.trim().length >= MIN_ARTICLE_CHARS
  ) {
    return record.articleBody;
  }

  for (const child of Object.values(record)) {
    const match = findArticleBody(child);
    if (match) return match;
  }
  return null;
}

export function extractArticleText(html: string): string | null {
  const document = new DOMParser().parseFromString(html, "text/html");
  if (!document) return null;

  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      const body = findArticleBody(JSON.parse(script.textContent ?? ""));
      if (body) return normaliseText(body);
    } catch {
      // Invalid JSON-LD is common; Reader View remains the primary fallback.
    }
  }

  const readable = new Readability(
    document as unknown as globalThis.Document,
  ).parse();
  const readerText = normaliseText(readable?.textContent ?? "");
  if (readerText.length >= MIN_ARTICLE_CHARS) return readerText;

  const articleText = normaliseText(
    document.querySelector("article")?.textContent ?? "",
  );
  return articleText.length >= MIN_ARTICLE_CHARS ? articleText : null;
}

async function fetchArticlePage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: ARTICLE_TTL_SECONDS },
    signal: AbortSignal.timeout(ARTICLE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error("Article did not return HTML");
  }
  return response.text();
}

export async function resolveArticle(item: FeedItem): Promise<ResolvedArticle> {
  if (isShitpostItem(item)) {
    const text = normaliseText(
      [item.title, item.excerpt].filter(Boolean).join("\n\n"),
    );
    return {
      text,
      source: "social-post",
      lengthGuide: getArticleLengthGuide(text),
    };
  }

  try {
    const text = extractArticleText(await fetchArticlePage(item.link));
    if (text) {
      return {
        text,
        source: "full-article",
        lengthGuide: getArticleLengthGuide(text),
      };
    }
  } catch {
    // Public pages can still be paywalled, blocked, or temporarily unavailable.
  }

  const excerpt = normaliseText(item.excerpt || item.title);
  return {
    text: excerpt,
    source: "rss-excerpt",
    lengthGuide: getArticleLengthGuide(excerpt),
  };
}
