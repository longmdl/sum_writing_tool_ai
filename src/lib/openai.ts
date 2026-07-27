import OpenAI from "openai";
import { loadStyleGuide } from "./style-guide";
import type { DraftContent, NewsItem } from "./types";

/**
 * Override with OPENAI_MODEL when a newer model is available on your account.
 * Any model supporting JSON response format works.
 */
export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

/** Low enough for a consistent house voice, high enough to avoid stilted prose. */
const TEMPERATURE = 0.6;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // The fix differs by environment, so point at the right one.
    throw new Error(
      process.env.VERCEL
        ? "OPENAI_API_KEY is not set. Add it in Vercel → Project Settings → Environment Variables, then redeploy."
        : "OPENAI_API_KEY is not set. Copy .env.example to .env.local and add your key.",
    );
  }
  client ??= new OpenAI({ apiKey });
  return client;
}

function formatSourceBrief(item: NewsItem, extraInstructions?: string): string {
  const published = item.publishedAt
    ? new Date(item.publishedAt).toISOString().slice(0, 10)
    : "unknown";

  const parts = [
    "Rewrite the following motorsport news item as a Vietnamese Facebook post,",
    "following the style guide exactly.",
    "",
    `SOURCE PUBLICATION: ${item.sourceName}`,
    `PUBLISHED: ${published}`,
    `HEADLINE (English): ${item.title}`,
    item.categories.length ? `TOPICS: ${item.categories.join(", ")}` : "",
    "",
    "PUBLISHER EXCERPT (this is all you have — do not invent beyond it):",
    item.excerpt || "(no excerpt provided; work from the headline alone)",
  ].filter(Boolean);

  if (extraInstructions?.trim()) {
    parts.push(
      "",
      "ADDITIONAL INSTRUCTIONS FROM THE EDITOR (these override nothing in the style guide, but apply where the guide is silent):",
      extraInstructions.trim(),
    );
  }

  parts.push(
    "",
    "Return only the JSON object described in the style guide's output contract.",
  );

  return parts.join("\n");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function parseDraft(raw: string): DraftContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The model did not return valid JSON. Try generating again.");
  }

  const obj = parsed as Record<string, unknown>;
  const headerTag = typeof obj.headerTag === "string" ? obj.headerTag.trim() : "";
  const body = asStringArray(obj.body);

  const missing = [!headerTag && "headerTag", body.length === 0 && "body"].filter(
    Boolean,
  );
  if (missing.length > 0) {
    throw new Error(`The model's response was missing: ${missing.join(", ")}.`);
  }

  const list = asStringArray(obj.list);
  const hook = typeof obj.hook === "string" ? obj.hook.trim() : "";

  return {
    // The guide requires caps; enforce it so one stray output cannot slip
    // through. 🚨 BREAKING keeps its emoji — toLocaleUpperCase leaves it alone.
    headerTag: headerTag.toLocaleUpperCase("vi-VN"),
    body,
    list: list.length > 0 ? list : undefined,
    hook: hook || undefined,
    topicHashtags: asStringArray(obj.topicHashtags),
  };
}

export async function generateDraft(
  item: NewsItem,
  extraInstructions?: string,
): Promise<{ draft: DraftContent; model: string }> {
  const [styleGuide, openai] = [await loadStyleGuide(), getClient()];

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: TEMPERATURE,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: styleGuide },
      { role: "user", content: formatSourceBrief(item, extraInstructions) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("The model returned an empty response.");

  return { draft: parseDraft(raw), model: completion.model };
}
