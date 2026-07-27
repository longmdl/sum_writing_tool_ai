"use client";

import { freshness, tierColor } from "@/lib/freshness";
import type { NewsItem } from "@/lib/types";

interface FeedBoardProps {
  items: NewsItem[];
  selectedId: string | null;
  onSelect: (item: NewsItem) => void;
  loading: boolean;
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <li className="flex gap-3 px-3 py-3.5 border-b border-guardrail/40">
      <span className="font-mono text-xs text-guardrail pt-0.5 tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded bg-carbon-hi w-4/5" />
        <div className="h-3 rounded bg-carbon-hi/60 w-2/5" />
      </div>
    </li>
  );
}

export default function FeedBoard({
  items,
  selectedId,
  onSelect,
  loading,
}: FeedBoardProps) {
  if (loading && items.length === 0) {
    return (
      <ul className="animate-pulse" aria-busy="true" aria-label="Đang tải tin">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonRow key={i} index={i} />
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <p className="px-4 py-10 text-sm text-dim">
        Không có tin nào. Bật ít nhất một nguồn ở trên.
      </p>
    );
  }

  return (
    <ul>
      {items.map((item, index) => {
        const fresh = freshness(item.publishedAt);
        const selected = item.id === selectedId;

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              aria-current={selected ? "true" : undefined}
              style={{ ["--edge" as string]: tierColor(fresh.tier) }}
              className={`delta-edge group w-full text-left flex gap-3 px-3 py-3 border-b border-guardrail/40 transition-colors duration-150 ${
                selected ? "bg-carbon-hi" : "hover:bg-carbon"
              }`}
            >
              {/* Classification position, as on a results board. */}
              <span className="font-mono text-xs text-dim pt-0.5 tabular-nums w-6 shrink-0">
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className="flex-1 min-w-0">
                <span
                  className={`block text-[13.5px] leading-snug ${
                    selected ? "text-white" : "text-[#d3d7e2] group-hover:text-white"
                  }`}
                >
                  {item.title}
                </span>

                <span className="mt-1.5 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider">
                  <span className="text-dim truncate">{item.sourceName}</span>
                  <span
                    className="tabular-nums shrink-0"
                    style={{ color: tierColor(fresh.tier) }}
                    title={fresh.description}
                  >
                    {fresh.label}
                  </span>
                  <span className="sr-only">{fresh.description}</span>
                </span>
              </span>

              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  className="w-16 h-11 object-cover rounded-sm shrink-0 bg-carbon-hi"
                />
              ) : (
                <span className="w-16 h-11 rounded-sm shrink-0 bg-carbon-hi grid place-items-center font-mono text-[10px] text-guardrail">
                  N/A
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
