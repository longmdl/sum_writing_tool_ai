import { NextResponse } from "next/server";
import { buildCaption } from "@/lib/caption";
import {
  generateDraftFromManualArticle,
  type ManualArticleInput,
} from "@/lib/openai";
import { coercePostSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ARTICLE_CHARS = 60_000;
const MIN_ARTICLE_CHARS = 120;
const MAX_EXTRA_INSTRUCTIONS = 1_000;

function textField(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? payload[key].trim() : "";
}

function validSourceUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const articleBody = textField(payload, "body");
  const article: ManualArticleInput = {
    title: textField(payload, "title").slice(0, 500),
    sourceName: textField(payload, "sourceName").slice(0, 200),
    sourceUrl: textField(payload, "sourceUrl").slice(0, 2_000),
    body: articleBody,
  };

  if (!article.title) {
    return NextResponse.json(
      { error: "Add the article headline first." },
      { status: 400 },
    );
  }
  if (!article.sourceName) {
    return NextResponse.json(
      { error: "Add the source publication for attribution." },
      { status: 400 },
    );
  }
  if (!validSourceUrl(article.sourceUrl)) {
    return NextResponse.json(
      { error: "Source URL must start with http:// or https://." },
      { status: 400 },
    );
  }
  if (article.body.length < MIN_ARTICLE_CHARS) {
    return NextResponse.json(
      { error: `Paste at least ${MIN_ARTICLE_CHARS} characters of article text.` },
      { status: 400 },
    );
  }
  if (article.body.length > MAX_ARTICLE_CHARS) {
    return NextResponse.json(
      { error: `Article cannot exceed ${MAX_ARTICLE_CHARS.toLocaleString()} characters.` },
      { status: 400 },
    );
  }

  const extraInstructions = textField(payload, "extraInstructions").slice(
    0,
    MAX_EXTRA_INSTRUCTIONS,
  );
  const settings = coercePostSettings(payload.settings);
  const includeSourceUrl =
    payload.includeSourceUrl === true && Boolean(article.sourceUrl);

  try {
    const { draft, model } = await generateDraftFromManualArticle(
      article,
      extraInstructions,
    );
    const caption = buildCaption(
      draft,
      { sourceName: article.sourceName, link: article.sourceUrl },
      settings,
      { includeSourceUrl },
    );
    return NextResponse.json({ draft, caption, model });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed unexpectedly.";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
