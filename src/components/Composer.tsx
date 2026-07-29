"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { Token } from "@astryxdesign/core/Token";
import { VStack } from "@astryxdesign/core/VStack";
import { captionStats } from "@/lib/caption";
import type {
  ArticleInputSource,
  ArticleLengthGuide,
  DraftContent,
  NewsItem,
  PostSettings,
} from "@/lib/types";

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
  inputSource: ArticleInputSource | null;
  lengthGuide: ArticleLengthGuide | null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

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
    <Button
      label={copied ? "Copied" : label}
      variant={copied ? "secondary" : "primary"}
      icon={copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      isDisabled={!value}
      onClick={copy}
    />
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
  inputSource,
  lengthGuide,
}: ComposerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const stats = captionStats(caption, draft);
  const overLimit =
    stats.bodyWords !== null &&
    lengthGuide !== null &&
    stats.bodyWords > lengthGuide.maxBodyWords;
  const offTarget =
    stats.bodyWords !== null &&
    lengthGuide !== null &&
    !overLimit &&
    stats.bodyWords < lengthGuide.minBodyWords;

  if (!item) {
    return (
      <VStack height="100%" minHeight={480} hAlign="center" vAlign="center" padding={8}>
        <EmptyState
          headingLevel={2}
          title="Chọn một story để bắt đầu"
          description="Mở một story trong News Feed. AI chỉ chạy khi bạn chủ động bấm Generate caption."
          icon={<Sparkles size={32} />}
        />
      </VStack>
    );
  }

  return (
    <VStack hAlign="center" padding={6}>
      <VStack width="100%" maxWidth={860} gap={5}>
        <Section variant="muted" padding={5}>
          <HStack gap={5} vAlign="start">
            <Thumbnail
              src={item.imageUrl ?? undefined}
              alt={item.imageUrl ? `Ảnh minh hoạ: ${item.title}` : undefined}
              label={item.title}
              onClick={
                item.imageUrl
                  ? () => window.open(item.imageUrl ?? "", "_blank", "noopener,noreferrer")
                  : undefined
              }
            />
            <VStack gap={3} width="100%">
              <HStack gap={2} wrap="wrap" vAlign="center">
                <Token label={item.sourceName} size="sm" color="gray" />
                {item.author ? (
                  <Text type="supporting" color="secondary">
                    {item.author}
                  </Text>
                ) : null}
              </HStack>
              <Heading level={2}>{item.title}</Heading>
              <HStack gap={3} wrap="wrap">
                <Button
                  label="Open original"
                  variant="secondary"
                  icon={<ExternalLink size={16} aria-hidden />}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                />
                {item.imageUrl ? (
                  <CopyButton value={item.imageUrl} label="Copy image link" />
                ) : null}
              </HStack>
            </VStack>
          </HStack>
        </Section>

        <Section variant="transparent" padding={0}>
          <VStack gap={1.5}>
            <Text type="supporting" color="disabled">
              RSS preview · Generate sẽ fetch full public article khi đọc được.
            </Text>
            <Text type="body" color="secondary" display="block">
              {item.excerpt}
            </Text>
          </VStack>
        </Section>

        <Divider />

        <HStack gap={3} wrap="wrap" vAlign="center" hAlign="between">
          <HStack gap={3} wrap="wrap">
            <Button
              label={
                caption
                  ? "Regenerate caption (tốn token)"
                  : "Generate Vietnamese caption"
              }
              variant="primary"
              icon={<Sparkles size={16} aria-hidden />}
              isLoading={generating}
              isDisabled={generating}
              onClick={onGenerate}
            />
            <Button
              label={showSettings ? "Hide settings" : "Post settings"}
              variant="secondary"
              icon={<Settings2 size={16} aria-hidden />}
              onClick={() => setShowSettings((value) => !value)}
            />
          </HStack>
          <HStack gap={2} wrap="wrap">
            {cached ? <Token label="Cached draft" size="sm" color="green" /> : null}
            {inputSource ? (
              <Token
                label={
                  inputSource === "full-article"
                    ? "Full article"
                    : "RSS fallback"
                }
                size="sm"
                color={inputSource === "full-article" ? "green" : "yellow"}
              />
            ) : null}
            {lengthGuide ? (
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {lengthGuide.sourceWords.toLocaleString("vi-VN")} source words ·
                target {lengthGuide.minBodyWords}–{lengthGuide.maxBodyWords}
              </Text>
            ) : null}
            {model ? <Token label={model} size="sm" color="gray" /> : null}
          </HStack>
        </HStack>

        {showSettings ? (
          <Section variant="muted" padding={5}>
            <VStack gap={5}>
              <Heading level={3}>Output settings</Heading>
              <TextInput
                label="Writer credit"
                value={settings.author}
                placeholder="Tên admin, ví dụ Sennar"
                onChange={(author) => onSettingsChange({ ...settings, author })}
              />
              <TextInput
                label="Core hashtags"
                value={settings.coreHashtags}
                description="AI sẽ thêm 3–6 topic hashtags sau các tag này."
                onChange={(coreHashtags) =>
                  onSettingsChange({ ...settings, coreHashtags })
                }
              />
              <VStack gap={2}>
                <Text type="label">Divider style</Text>
                <HStack gap={3} wrap="wrap">
                  <Button
                    label="Em dash"
                    variant={
                      settings.divider === "em-dash" ? "primary" : "secondary"
                    }
                    onClick={() =>
                      onSettingsChange({ ...settings, divider: "em-dash" })
                    }
                  >
                    ————————
                  </Button>
                  <Button
                    label="Underscore"
                    variant={
                      settings.divider === "underscore" ? "primary" : "secondary"
                    }
                    onClick={() =>
                      onSettingsChange({ ...settings, divider: "underscore" })
                    }
                  >
                    __________
                  </Button>
                </HStack>
              </VStack>
              <TextArea
                label="Extra notes for AI"
                isOptional
                value={extraInstructions}
                rows={3}
                placeholder="Ví dụ: nhấn mạnh chiến thuật lốp, bỏ phần tiểu sử."
                onChange={onExtraInstructionsChange}
              />
              <CheckboxInput
                label="Include link trong dòng Nguồn:"
                description="Source name luôn được ghi. Link có thể thay đổi Facebook link preview."
                value={includeSourceUrl}
                onChange={onIncludeSourceUrlChange}
              />
            </VStack>
          </Section>
        ) : null}

        {error ? (
          <Banner
            status="error"
            title="Không thể generate caption"
            description={error}
          />
        ) : null}

        {caption ? (
          <Section variant="section" padding={5}>
            <VStack gap={4}>
              <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
                <VStack gap={0.5}>
                  <Heading level={3}>Facebook draft</Heading>
                  <Text type="supporting" color="secondary">
                    Edit trực tiếp trước khi publish.
                  </Text>
                </VStack>
                <Text
                  type="supporting"
                  color={overLimit ? "accent" : "secondary"}
                  hasTabularNumbers
                >
                  {stats.bodyWords !== null
                    ? `Body ${stats.bodyWords} từ · `
                    : ""}
                  {stats.characters} characters
                </Text>
              </HStack>
              <TextArea
                label="Caption"
                isLabelHidden
                value={caption}
                rows={22}
                hasSpellCheck={false}
                status={
                  overLimit
                      ? {
                          type: "error",
                          message: `Body vượt target tối đa ${lengthGuide?.maxBodyWords ?? 0} từ cho article này.`,
                        }
                      : offTarget
                        ? {
                            type: "warning",
                            message: `Target cho article này là ${lengthGuide?.minBodyWords ?? 0}–${lengthGuide?.maxBodyWords ?? 0} từ.`,
                          }
                      : undefined
                }
                onChange={onCaptionChange}
              />
              <HStack gap={3} wrap="wrap">
                <CopyButton value={caption} label="Copy caption" />
                {item.imageUrl ? (
                  <Button
                    label="Open image to download"
                    variant="secondary"
                    icon={<Download size={16} aria-hidden />}
                    href={item.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ) : null}
              </HStack>
            </VStack>
          </Section>
        ) : null}
      </VStack>
    </VStack>
  );
}
