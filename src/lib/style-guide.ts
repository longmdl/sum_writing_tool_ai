import { readFile } from "node:fs/promises";
import path from "node:path";

const STYLE_GUIDE_PATH = path.join(process.cwd(), "content", "style-guide.md");

let cached: { text: string; loadedAt: number } | null = null;

/** In dev, re-read so edits to the guide land without a restart. */
const CACHE_MS = process.env.NODE_ENV === "production" ? Infinity : 1_000;

export async function loadStyleGuide(): Promise<string> {
  if (cached && Date.now() - cached.loadedAt < CACHE_MS) {
    return cached.text;
  }
  try {
    const text = await readFile(STYLE_GUIDE_PATH, "utf8");
    cached = { text, loadedAt: Date.now() };
    return text;
  } catch (error) {
    throw new Error(
      `Could not read content/style-guide.md — the writing rules are missing. (${
        error instanceof Error ? error.message : "unknown error"
      })`,
    );
  }
}
