/**
 * Dependency-free RSS 2.0 reader.
 *
 * Deliberately small: the four feeds we read are well-formed RSS with a stable
 * shape, so a full XML parser would be weight we never use. It handles CDATA,
 * numeric and named entities, and the handful of namespaced tags these
 * publishers actually emit.
 */

export interface RawFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  guid: string | null;
  author: string | null;
  imageUrl: string | null;
  categories: string[];
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  eacute: "é",
  egrave: "è",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ccedil: "ç",
  deg: "°",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named ?? match;
  });
}

function stripCdata(value: string): string {
  const match = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return match ? match[1] : value;
}

/** Reads the first `<tag>...</tag>`, tolerating attributes and namespaces. */
function tagContent(block: string, tag: string): string | null {
  const escaped = tag.replace(/[:]/g, "\\:");
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, "i");
  const match = block.match(re);
  return match ? stripCdata(match[1]) : null;
}

function allTagContents(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  return [...block.matchAll(re)].map((m) => stripCdata(m[1]));
}

/** Reads an attribute off the first matching self-closing or open tag. */
function tagAttribute(block: string, tag: string, attr: string): string | null {
  const escaped = tag.replace(/[:]/g, "\\:");
  const re = new RegExp(`<${escaped}\\s[^>]*${attr}=["']([^"']+)["']`, "i");
  const match = block.match(re);
  return match ? match[1] : null;
}

/** HTML excerpt -> readable plain text. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    // Feeds tack a "read more" affordance onto the excerpt; it is not content.
    .replace(/\s*(Keep reading|Read more|Continue reading)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRss(xml: string): RawFeedItem[] {
  const blocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(
    (m) => m[1],
  );

  return blocks.map((block) => {
    const rawTitle = tagContent(block, "title") ?? "";
    const rawDescription =
      tagContent(block, "description") ?? tagContent(block, "content:encoded") ?? "";

    // Publishers disagree on where the image lives; check each in turn.
    const imageUrl =
      tagAttribute(block, "enclosure", "url") ??
      tagAttribute(block, "media:content", "url") ??
      tagAttribute(block, "media:thumbnail", "url") ??
      (rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null);

    return {
      title: htmlToText(rawTitle),
      link: decodeEntities((tagContent(block, "link") ?? "").trim()),
      description: htmlToText(rawDescription),
      pubDate: tagContent(block, "pubDate")?.trim() ?? null,
      guid: tagContent(block, "guid")?.trim() ?? null,
      author:
        tagContent(block, "dc:creator")?.trim() ??
        tagContent(block, "author")?.trim() ??
        null,
      imageUrl: imageUrl ? decodeEntities(imageUrl) : null,
      categories: allTagContents(block, "category").map((c) => htmlToText(c)),
    };
  });
}
