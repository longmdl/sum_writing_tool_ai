import type { DraftContent, NewsItem, PostSettings } from "./types";

/** Matches the house format: 13 underscores above, 10 below. */
const TOP_RULE = "_____________";
const BOTTOM_RULE = "__________";

export const DEFAULT_SETTINGS: PostSettings = {
  author: "",
  hashtags: "#SUM #clubhouse #Thethaotocdo #Vanhoaxe",
  discordLine: "I✒️ Hãy chung tay đóng góp và chia sẻ content qua Discord của SUM",
  ctaLine: "Tham gia CLB ngay hôm nay",
};

export interface CaptionOptions {
  includeSourceUrl?: boolean;
}

/**
 * Assembles the final caption from the model's four fields plus the fixed
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

  lines.push(draft.headline.trim());
  lines.push(TOP_RULE);
  lines.push(draft.lead.trim());

  for (const paragraph of draft.body) {
    const text = paragraph.trim();
    if (text) lines.push(text);
  }

  if (draft.list && draft.list.items.length > 0) {
    lines.push(draft.list.label.trim());
    for (const entry of draft.list.items) {
      const text = entry.trim();
      if (text) lines.push(text);
    }
  }

  lines.push(draft.closingQuestion.trim());
  lines.push(BOTTOM_RULE);

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
  if (settings.hashtags.trim()) lines.push(`${settings.hashtags.trim()} `);
  if (settings.ctaLine.trim()) lines.push(settings.ctaLine.trim());

  return lines.join("\n");
}

/** Facebook truncates around 400–500 characters; useful signal for the admin. */
export function captionStats(caption: string) {
  const characters = caption.length;
  const words = caption.trim().split(/\s+/).filter(Boolean).length;
  return { characters, words };
}
