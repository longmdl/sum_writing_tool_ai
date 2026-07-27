import { DEFAULT_SETTINGS } from "./caption";
import type { PostSettings } from "./types";

export function coercePostSettings(raw: unknown): PostSettings {
  const input = (raw ?? {}) as Partial<Record<keyof PostSettings, unknown>>;
  const pick = (key: "author" | "coreHashtags" | "discordLine" | "ctaLine") =>
    typeof input[key] === "string"
      ? (input[key] as string)
      : DEFAULT_SETTINGS[key];

  return {
    author: pick("author").slice(0, 120),
    coreHashtags: pick("coreHashtags").slice(0, 300),
    discordLine: pick("discordLine").slice(0, 300),
    ctaLine: pick("ctaLine").slice(0, 200),
    divider:
      input.divider === "underscore" || input.divider === "em-dash"
        ? input.divider
        : DEFAULT_SETTINGS.divider,
  };
}
