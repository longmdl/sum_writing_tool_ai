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
      label={copied ? "Đã sao chép" : label}
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
}: ComposerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const stats = captionStats(caption, draft);
  const overLimit = stats.bodyWords !== null && stats.bodyWords > 200;
  const offTarget =
    stats.bodyWords !== null &&
    !overLimit &&
    (stats.bodyWords < 60 || stats.bodyWords > 150);

  if (!item) {
    return (
      <VStack height="100%" minHeight={480} hAlign="center" vAlign="center" padding={6}>
        <EmptyState
          headingLevel={2}
          title="Chọn một tin để bắt đầu"
          description="Mở một mục trong hàng đợi. AI chỉ chạy khi bạn chủ động bấm Soạn caption."
          icon={<Sparkles size={32} />}
        />
      </VStack>
    );
  }

  return (
    <VStack hAlign="center" padding={5}>
      <VStack width="100%" maxWidth={820} gap={4}>
        <Section variant="muted" padding={4}>
          <HStack gap={4} vAlign="start">
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
            <VStack gap={2} width="100%">
              <HStack gap={1.5} wrap="wrap" vAlign="center">
                <Token label={item.sourceName} size="sm" color="gray" />
                {item.author ? (
                  <Text type="supporting" color="secondary">
                    {item.author}
                  </Text>
                ) : null}
              </HStack>
              <Heading level={2}>{item.title}</Heading>
              <HStack gap={2} wrap="wrap">
                <Button
                  label="Mở bài gốc"
                  variant="secondary"
                  icon={<ExternalLink size={16} aria-hidden />}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                />
                {item.imageUrl ? (
                  <CopyButton value={item.imageUrl} label="Sao chép link ảnh" />
                ) : null}
              </HStack>
            </VStack>
          </HStack>
        </Section>

        <Section variant="transparent" padding={0}>
          <Text type="body" color="secondary" display="block">
            {item.excerpt}
          </Text>
        </Section>

        <Divider />

        <HStack gap={2} wrap="wrap" vAlign="center" hAlign="between">
          <HStack gap={2} wrap="wrap">
            <Button
              label={
                caption ? "Soạn lại caption (tốn token)" : "Soạn caption tiếng Việt"
              }
              variant="primary"
              icon={<Sparkles size={16} aria-hidden />}
              isLoading={generating}
              isDisabled={generating}
              onClick={onGenerate}
            />
            <Button
              label={showSettings ? "Ẩn tuỳ chỉnh" : "Tuỳ chỉnh bài viết"}
              variant="secondary"
              icon={<Settings2 size={16} aria-hidden />}
              onClick={() => setShowSettings((value) => !value)}
            />
          </HStack>
          <HStack gap={1.5} wrap="wrap">
            {cached ? <Token label="Đã lưu trong phiên" size="sm" color="green" /> : null}
            {model ? <Token label={model} size="sm" color="gray" /> : null}
          </HStack>
        </HStack>

        {showSettings ? (
          <Section variant="muted" padding={4}>
            <VStack gap={4}>
              <Heading level={3}>Tuỳ chỉnh đầu ra</Heading>
              <TextInput
                label="Credit soạn bài"
                value={settings.author}
                placeholder="Tên admin, ví dụ Sennar"
                onChange={(author) => onSettingsChange({ ...settings, author })}
              />
              <TextInput
                label="Hashtag cố định"
                value={settings.coreHashtags}
                description="AI sẽ thêm 3–6 hashtag theo chủ đề sau các tag này."
                onChange={(coreHashtags) =>
                  onSettingsChange({ ...settings, coreHashtags })
                }
              />
              <VStack gap={1.5}>
                <Text type="label">Đường phân cách</Text>
                <HStack gap={2} wrap="wrap">
                  <Button
                    label="Dấu gạch dài"
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
                    label="Dấu gạch dưới"
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
                label="Dặn thêm cho AI"
                isOptional
                value={extraInstructions}
                rows={3}
                placeholder="Ví dụ: nhấn mạnh chiến thuật lốp, bỏ phần tiểu sử."
                onChange={onExtraInstructionsChange}
              />
              <CheckboxInput
                label="Kèm link trong dòng Nguồn:"
                description="Tên nguồn luôn được ghi. Link có thể thay đổi cách Facebook tạo ảnh xem trước."
                value={includeSourceUrl}
                onChange={onIncludeSourceUrlChange}
              />
            </VStack>
          </Section>
        ) : null}

        {error ? (
          <Banner
            status="error"
            title="Không thể soạn caption"
            description={error}
          />
        ) : null}

        {caption ? (
          <Section variant="section" padding={4}>
            <VStack gap={3}>
              <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
                <VStack gap={0.5}>
                  <Heading level={3}>Bản nháp Facebook</Heading>
                  <Text type="supporting" color="secondary">
                    Có thể sửa trực tiếp trước khi đăng.
                  </Text>
                </VStack>
                <Text
                  type="supporting"
                  color={overLimit ? "accent" : "secondary"}
                  hasTabularNumbers
                >
                  {stats.bodyWords !== null
                    ? `Thân bài ${stats.bodyWords} từ · `
                    : ""}
                  {stats.characters} ký tự
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
                        message: "Thân bài vượt giới hạn tối đa 200 từ.",
                      }
                    : offTarget
                      ? {
                          type: "warning",
                          message: "Mục tiêu đề xuất là 60–150 từ.",
                        }
                      : undefined
                }
                onChange={onCaptionChange}
              />
              <HStack gap={2} wrap="wrap">
                <CopyButton value={caption} label="Sao chép caption" />
                {item.imageUrl ? (
                  <Button
                    label="Mở ảnh để tải"
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
