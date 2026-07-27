"use client";

import { useEffect, useRef, useState } from "react";
import { captionStats } from "@/lib/caption";
import type { DraftContent, NewsItem, PostSettings } from "@/lib/types";

interface ComposerProps {
  item: NewsItem | null;
  caption: string;
  draft: DraftContent | null;
  onCaptionChange: (value: string) => void;
  settings: PostSettings;
  onSettingsChange: (next: PostSettings) => void;
  includeSourceUrl: boolean;
  onIncludeSourceUrlChange: (value: boolean) => void;
  extraInstructions: string;
  onExtraInstructionsChange: (value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
  model: string | null;
  cached: boolean;
}

function CopyButton({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      className={`font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-sm transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {copied ? "Đã chép ✓" : label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-soft mb-1">
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-paper-hi border border-ink/15 rounded-sm px-2.5 py-2 text-sm text-ink placeholder:text-ink-soft/60"
      />
    </label>
  );
}

export default function Composer({
  item,
  caption,
  draft,
  onCaptionChange,
  settings,
  onSettingsChange,
  includeSourceUrl,
  onIncludeSourceUrlChange,
  extraInstructions,
  onExtraInstructionsChange,
  onGenerate,
  generating,
  error,
  model,
  cached,
}: ComposerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const stats = captionStats(caption, draft);

  // The guide caps the body at 200 words and targets 60–150.
  const overLimit = stats.bodyWords !== null && stats.bodyWords > 200;
  const offTarget =
    stats.bodyWords !== null && !overLimit && (stats.bodyWords < 60 || stats.bodyWords > 150);

  if (!item) {
    return (
      <div className="h-full grid place-items-center px-8 py-16 text-center">
        <div className="max-w-sm">
          <p className="font-display text-2xl text-ink font-semibold tracking-tight">
            Chọn một tin bên trái
          </p>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed">
            Bảng bên trái xếp 10 tin mới nhất theo thời gian đăng. Màu tím là mới
            nhất, rồi xanh lá, vàng, xám.
          </p>
          <p className="mt-3 text-[12px] text-ink-soft/80 leading-relaxed">
            Chọn tin không tốn token. AI chỉ chạy khi bạn bấm nút soạn.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-5 sm:px-7 sm:py-6 max-w-2xl mx-auto">
      {/* Source card: everything the admin needs to grab, including the image. */}
      <div className="flex gap-4">
        {item.imageUrl ? (
          <a href={item.imageUrl} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-sm border border-ink/10"
            />
          </a>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            {item.sourceName}
            {item.author ? ` · ${item.author}` : ""}
          </p>
          <h2 className="mt-1 font-display text-lg sm:text-xl leading-tight text-ink font-semibold">
            {item.title}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1.5 rounded-sm bg-ink/8 text-ink hover:bg-ink/15 transition-colors"
            >
              Mở bài gốc ↗
            </a>
            {item.imageUrl ? (
              <CopyButton
                value={item.imageUrl}
                label="Chép link ảnh"
                className="bg-ink/8 text-ink hover:bg-ink/15 !py-1.5 !px-2.5"
              />
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-soft border-l-2 border-ink/15 pl-3">
        {item.excerpt}
      </p>

      {/* Generate — the only thing here that spends tokens. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="font-display font-semibold text-sm tracking-tight px-5 py-2.5 rounded-sm bg-flag text-white hover:brightness-110 disabled:opacity-60 disabled:cursor-wait transition-all duration-150"
        >
          {generating
            ? "Đang soạn…"
            : caption
              ? "Soạn lại (tốn token)"
              : "Soạn caption tiếng Việt"}
        </button>

        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          className="font-mono text-[11px] uppercase tracking-wider px-3 py-2.5 rounded-sm text-ink-soft hover:text-ink transition-colors"
        >
          {showSettings ? "Ẩn tuỳ chỉnh" : "Tuỳ chỉnh"}
        </button>

        <span className="ml-auto flex items-center gap-2">
          {cached ? (
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-ink-soft/70"
              title="Lấy lại từ phiên này — không gọi lại AI"
            >
              đã lưu
            </span>
          ) : null}
          {model ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft/70">
              {model}
            </span>
          ) : null}
        </span>
      </div>

      {showSettings ? (
        <div className="mt-4 p-4 rounded-sm bg-ink/[0.04] border border-ink/10 space-y-3">
          <Field
            label="Credit soạn bài"
            value={settings.author}
            placeholder="Tên admin, ví dụ Sennar"
            onChange={(author) => onSettingsChange({ ...settings, author })}
          />
          <Field
            label="Hashtag cố định"
            value={settings.coreHashtags}
            onChange={(coreHashtags) => onSettingsChange({ ...settings, coreHashtags })}
          />
          <p className="text-[11px] text-ink-soft leading-relaxed -mt-1.5">
            AI tự thêm 3–6 hashtag theo chủ đề sau các tag cố định này.
          </p>

          <fieldset>
            <legend className="block font-mono text-[10px] uppercase tracking-wider text-ink-soft mb-1.5">
              Đường phân cách
            </legend>
            <div className="flex gap-2">
              {(
                [
                  ["em-dash", "————————"],
                  ["underscore", "__________"],
                ] as const
              ).map(([value, preview]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={settings.divider === value}
                  onClick={() => onSettingsChange({ ...settings, divider: value })}
                  className={`font-mono text-[11px] px-3 py-2 rounded-sm border transition-colors ${
                    settings.divider === value
                      ? "border-ink/40 bg-ink/10 text-ink"
                      : "border-ink/15 text-ink-soft hover:text-ink"
                  }`}
                >
                  {preview}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-soft mb-1">
              Dặn thêm cho AI (tuỳ chọn)
            </span>
            <textarea
              value={extraInstructions}
              rows={2}
              placeholder="Ví dụ: nhấn mạnh phần chiến thuật lốp, bỏ phần tiểu sử."
              onChange={(event) => onExtraInstructionsChange(event.target.value)}
              className="w-full bg-paper-hi border border-ink/15 rounded-sm px-2.5 py-2 text-sm text-ink placeholder:text-ink-soft/60 resize-y"
            />
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSourceUrl}
              onChange={(event) => onIncludeSourceUrlChange(event.target.checked)}
              className="mt-0.5 accent-flag w-4 h-4"
            />
            <span className="text-[13px] text-ink leading-snug">
              Kèm link vào dòng <span className="font-mono">Nguồn:</span>
              <span className="block text-ink-soft text-[12px]">
                Tên nguồn luôn được ghi. Bật link sẽ đổi cách Facebook hiện ảnh
                xem trước.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 text-[13px] leading-relaxed text-flag bg-flag/8 border border-flag/25 rounded-sm px-3 py-2.5"
        >
          {error}
        </p>
      ) : null}

      {/* The caption itself — editable, because admins always tweak. */}
      {caption ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              Caption · sửa thoải mái trước khi đăng
            </span>
            <span
              className={`font-mono text-[10px] tabular-nums ${
                overLimit
                  ? "text-flag"
                  : offTarget
                    ? "text-ink-soft"
                    : "text-ink-soft/70"
              }`}
              title="Đếm từ phần thân bài — mục tiêu 60–150 từ, tối đa 200"
            >
              {stats.bodyWords !== null ? `thân bài ${stats.bodyWords} từ · ` : ""}
              {stats.characters} ký tự
            </span>
          </div>

          <textarea
            value={caption}
            onChange={(event) => onCaptionChange(event.target.value)}
            rows={20}
            spellCheck={false}
            className="w-full bg-paper-hi border border-ink/15 rounded-sm px-4 py-3.5 text-[14.5px] leading-[1.65] text-ink resize-y font-body"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton
              value={caption}
              label="Chép caption"
              className="bg-ink text-paper hover:bg-ink/85"
            />
            {item.imageUrl ? (
              <a
                href={item.imageUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-sm bg-ink/8 text-ink hover:bg-ink/15 transition-colors"
              >
                Tải ảnh ↓
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
