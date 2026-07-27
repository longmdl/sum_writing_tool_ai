"use client";

import type { Source, SourceId } from "@/lib/types";

interface SourcePickerProps {
  sources: Source[];
  enabled: SourceId[];
  onToggle: (id: SourceId) => void;
}

export default function SourcePicker({
  sources,
  enabled,
  onToggle,
}: SourcePickerProps) {
  return (
    <fieldset className="px-3 py-3 border-b border-guardrail/40">
      <legend className="sr-only">Nguồn tin</legend>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => {
          const on = enabled.includes(source.id);
          const restricted = source.policy.blocksAiCrawlers;

          return (
            <button
              key={source.id}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => onToggle(source.id)}
              title={source.policy.note}
              className={`font-mono text-[10.5px] uppercase tracking-wider px-2.5 py-1.5 rounded-sm border transition-colors duration-150 ${
                on
                  ? "border-guardrail bg-carbon-hi text-white"
                  : "border-guardrail/50 text-dim hover:text-white hover:border-guardrail"
              }`}
            >
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                style={{
                  background: on ? "var(--color-green)" : "var(--color-guardrail)",
                }}
              />
              {source.name}
              {restricted ? (
                <span
                  className="ml-1.5 text-yellow"
                  title="Nhà xuất bản giới hạn việc dùng cho AI — luôn ghi nguồn"
                >
                  ▲
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {enabled.some(
        (id) => sources.find((s) => s.id === id)?.policy.blocksAiCrawlers,
      ) ? (
        <p className="mt-2.5 text-[11px] leading-relaxed text-dim">
          <span className="text-yellow">▲</span> Nguồn này cho phép dùng để tham
          khảo nhưng cấm huấn luyện AI. Công cụ chỉ tóm tắt từ phần trích RSS và
          luôn ghi <span className="font-mono">Nguồn:</span> — giữ nguyên dòng đó
          khi đăng.
        </p>
      ) : null}
    </fieldset>
  );
}
