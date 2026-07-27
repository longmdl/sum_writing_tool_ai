import type { DraftContent, NewsItem, PostSettings } from "./types";

/** Both dividers are house style; the admin picks one and keeps it consistent. */
const DIVIDERS: Record<PostSettings["divider"], string> = {
  "em-dash": "————————",
  underscore: "__________",
};

/** List items sit indented under the colon line that introduces them. */
const LIST_INDENT = "  ";

export const DEFAULT_SETTINGS: PostSettings = {
  author: "",
  coreHashtags: "#SUM #clubhouse #Thethaotocdo #Vanhoaxe",
  discordLine: "I✒️ Hãy chung tay đóng góp và chia sẻ content qua Discord của SUM",
  ctaLine: "Tham gia CLB ngay hôm nay",
  divider: "em-dash",
};

export interface CaptionOptions {
  includeSourceUrl?: boolean;
}

function normaliseTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

/**
 * Assembles the final post from the five fields the model writes plus the fixed
 * footer. The footer is built here rather than generated so it is identical on
 * every post — and so the `Nguồn:` credit cannot be dropped.
 */
export function buildCaption(
  draft: DraftContent,
  item: NewsItem,
  settings: PostSettings,
  options: CaptionOptions = {},
): string {
  const lines: string[] = [];

  lines.push(draft.headerTag.trim());

  for (const paragraph of draft.body) {
    const text = paragraph.trim();
    if (text) lines.push(text);
  }

  if (draft.list && draft.list.length > 0) {
    for (const entry of draft.list) {
      const text = entry.trim();
      if (text) lines.push(`${LIST_INDENT}${text}`);
    }
  }

  if (draft.hook?.trim()) lines.push(draft.hook.trim());

  lines.push(DIVIDERS[settings.divider] ?? DIVIDERS["em-dash"]);

  // Attribution is not optional. The source name is always present; the URL is
  // an admin preference because it changes Facebook's link preview behaviour.
  lines.push(
    options.includeSourceUrl
      ? `Nguồn: ${item.sourceName} — ${item.link}`
      : `Nguồn: ${item.sourceName}`,
  );

  if (settings.author.trim()) {
    lines.push(`I❤️ Credit soạn bài: ${settings.author.trim()}`);
  }
  if (settings.discordLine.trim()) lines.push(settings.discordLine.trim());

  // Core tags always lead, then the model's topic tags, deduped.
  const core = settings.coreHashtags.trim().split(/\s+/).filter(Boolean);
  const topic = draft.topicHashtags.map(normaliseTag).filter(Boolean);
  const seen = new Set(core.map((t) => t.toLowerCase()));
  const merged = [...core];
  for (const tag of topic) {
    if (!seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      merged.push(tag);
    }
  }
  if (merged.length > 0) lines.push(merged.join(" "));

  if (settings.ctaLine.trim()) lines.push(settings.ctaLine.trim());

  return lines.join("\n");
}

/**
 * The guide caps the body at 200 Vietnamese words, so the admin needs to see the
 * body count — not the whole post, which the footer would inflate.
 */
export function captionStats(caption: string, draft?: DraftContent | null) {
  const characters = caption.length;
  const words = caption.trim().split(/\s+/).filter(Boolean).length;

  let bodyWords: number | null = null;
  if (draft) {
    const bodyText = [...draft.body, draft.hook ?? "", ...(draft.list ?? [])]
      .join(" ")
      .trim();
    bodyWords = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
  }

  return { characters, words, bodyWords };
}
