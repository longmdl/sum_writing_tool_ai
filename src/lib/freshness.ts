/**
 * Maps a story's age onto Formula 1 timing-screen colours: purple for the
 * session best, green for a personal best, yellow for down on the lap. An admin
 * scanning the board reads "how urgent is this" without parsing a timestamp.
 */
export type FreshnessTier = "purple" | "green" | "yellow" | "grey";

export interface Freshness {
  tier: FreshnessTier;
  /** Compact delta, timing-screen style: 14m, 3h, 2d. */
  label: string;
  /** Spoken form, for screen readers and tooltips. */
  description: string;
}

const TIER_VAR: Record<FreshnessTier, string> = {
  purple: "var(--color-purple)",
  green: "var(--color-green)",
  yellow: "var(--color-yellow)",
  grey: "var(--color-dim)",
};

export function tierColor(tier: FreshnessTier): string {
  return TIER_VAR[tier];
}

export function freshness(publishedAt: string | null, now = Date.now()): Freshness {
  if (!publishedAt) {
    return { tier: "grey", label: "--", description: "Không rõ thời gian đăng" };
  }

  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) {
    return { tier: "grey", label: "--", description: "Không rõ thời gian đăng" };
  }

  const minutes = Math.max(0, Math.round((now - published) / 60_000));

  if (minutes < 60) {
    return {
      tier: "purple",
      label: `${minutes}m`,
      description: `Đăng ${minutes} phút trước`,
    };
  }

  const hours = Math.round(minutes / 60);
  if (hours < 6) {
    return { tier: "green", label: `${hours}h`, description: `Đăng ${hours} giờ trước` };
  }
  if (hours < 24) {
    return { tier: "yellow", label: `${hours}h`, description: `Đăng ${hours} giờ trước` };
  }

  const days = Math.round(hours / 24);
  return { tier: "grey", label: `${days}d`, description: `Đăng ${days} ngày trước` };
}
