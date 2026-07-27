"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, FileText, Sparkles } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import {
  Layout,
  LayoutContent,
  LayoutPanel,
} from "@astryxdesign/core/Layout";
import { Section } from "@astryxdesign/core/Section";
import { StackItem } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { VStack } from "@astryxdesign/core/VStack";
import { captionStats } from "@/lib/caption";
import type { DraftContent, PostSettings } from "@/lib/types";

const MAX_ARTICLE_CHARS = 60_000;
const MIN_ARTICLE_CHARS = 120;

interface ManualArticleWorkspaceProps {
  isDesktop: boolean;
  settings: PostSettings;
  includeSourceUrl: boolean;
  onIncludeSourceUrlChange: (value: boolean) => void;
}

interface ManualGenerateResponse {
  caption?: string;
  draft?: DraftContent;
  model?: string;
  error?: string;
}

interface ManualSessionState {
  title: string;
  sourceName: string;
  sourceUrl: string;
  body: string;
  extraInstructions: string;
  caption: string;
  draft: DraftContent | null;
  model: string | null;
}

let manualSessionState: ManualSessionState = {
  title: "",
  sourceName: "",
  sourceUrl: "",
  body: "",
  extraInstructions: "",
  caption: "",
  draft: null,
  model: null,
};

function CopyCaptionButton({ caption }: { caption: string }) {
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
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      label={copied ? "Copied" : "Copy caption"}
      variant={copied ? "secondary" : "primary"}
      icon={copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      onClick={copy}
    />
  );
}

export default function ManualArticleWorkspace({
  isDesktop,
  settings,
  includeSourceUrl,
  onIncludeSourceUrlChange,
}: ManualArticleWorkspaceProps) {
  const [session, setSession] = useState<ManualSessionState>(
    () => manualSessionState,
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    title,
    sourceName,
    sourceUrl,
    body,
    extraInstructions,
    caption,
    draft,
    model,
  } = session;

  function updateSession(patch: Partial<ManualSessionState>) {
    setSession((current) => {
      const next = { ...current, ...patch };
      manualSessionState = next;
      return next;
    });
  }

  const articleLength = body.trim().length;
  const canGenerate =
    title.trim().length > 0 &&
    sourceName.trim().length > 0 &&
    articleLength >= MIN_ARTICLE_CHARS &&
    articleLength <= MAX_ARTICLE_CHARS &&
    !generating;
  const stats = captionStats(caption, draft);
  const overLimit = stats.bodyWords !== null && stats.bodyWords > 200;

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sourceName,
          sourceUrl,
          body,
          extraInstructions,
          settings,
          includeSourceUrl,
        }),
      });
      const data = (await response.json()) as ManualGenerateResponse;
      if (!response.ok || !data.caption) {
        throw new Error(data.error ?? "Generate caption thất bại.");
      }
      updateSession({
        caption: data.caption,
        draft: data.draft ?? null,
        model: data.model ?? null,
      });
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Generate caption thất bại.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const inputPanel = (
    <VStack height={isDesktop ? "100%" : undefined} gap={0}>
      <Toolbar
        label="Manual article controls"
        size="lg"
        gap={3}
        variant="section"
        startContent={
          <VStack gap={0.5}>
            <Heading level={1}>Manual Article</Heading>
            <Text type="supporting" color="secondary">
              Paste full text when a source cannot be scraped
            </Text>
          </VStack>
        }
      />
      <StackItem size={isDesktop ? "fill" : undefined} isScrollable={isDesktop}>
        <VStack gap={5} padding={5}>
          <Section variant="muted" padding={4}>
            <Text type="supporting" color="secondary">
              Nội dung chỉ được gửi vào AI context khi bạn bấm Generate. Tool
              giữ trong tab session và không lưu article này vào feed.
            </Text>
          </Section>

          <FormLayout direction="vertical">
            <TextInput
              label="Article headline"
              isRequired
              value={title}
              placeholder="Paste the original headline"
              hasClear
              onChange={(value) => updateSession({ title: value })}
            />
            <TextInput
              label="Source publication"
              isRequired
              value={sourceName}
              placeholder="Ví dụ: RaceFans, Traxion.GG"
              hasClear
              onChange={(value) => updateSession({ sourceName: value })}
            />
            <TextInput
              label="Source URL"
              isOptional
              value={sourceUrl}
              placeholder="https://..."
              description="Dùng cho attribution và có thể kèm trong dòng Nguồn:."
              hasClear
              onChange={(value) => updateSession({ sourceUrl: value })}
            />
            <TextArea
              label="Full article text"
              isRequired
              value={body}
              rows={isDesktop ? 18 : 14}
              maxLength={MAX_ARTICLE_CHARS}
              placeholder="Paste the complete article body here…"
              description={`Minimum ${MIN_ARTICLE_CHARS} characters. Navigation, cookie notices và ads nên được bỏ nếu có thể.`}
              status={
                articleLength > MAX_ARTICLE_CHARS
                  ? {
                      type: "error",
                      message: `Article vượt giới hạn ${MAX_ARTICLE_CHARS.toLocaleString()} characters.`,
                    }
                  : body.length > 0 && articleLength < MIN_ARTICLE_CHARS
                  ? {
                      type: "warning",
                      message: `Cần ít nhất ${MIN_ARTICLE_CHARS} characters để tạo caption đáng tin cậy.`,
                    }
                  : undefined
              }
              onChange={(value) => updateSession({ body: value })}
            />
            <TextArea
              label="Extra notes for AI"
              isOptional
              value={extraInstructions}
              rows={3}
              maxLength={1_000}
              placeholder="Ví dụ: tập trung vào strategy, bỏ phần background."
              onChange={(value) =>
                updateSession({ extraInstructions: value })
              }
            />
            <CheckboxInput
              label="Include link trong dòng Nguồn:"
              description={
                sourceUrl.trim()
                  ? "Source name luôn được ghi; URL sẽ được thêm vào caption."
                  : "Add Source URL first nếu muốn kèm link."
              }
              value={includeSourceUrl}
              onChange={onIncludeSourceUrlChange}
            />
          </FormLayout>

          {error ? (
            <Banner
              status="error"
              title="Không thể generate caption"
              description={error}
            />
          ) : null}

          <Button
            label={caption ? "Regenerate caption" : "Generate Vietnamese caption"}
            variant="primary"
            icon={<Sparkles size={16} aria-hidden />}
            isLoading={generating}
            isDisabled={!canGenerate}
            onClick={generate}
          />
        </VStack>
      </StackItem>
    </VStack>
  );

  const outputPanel = (
    <VStack height={isDesktop ? "100%" : undefined} hAlign="center" padding={6}>
      <VStack width="100%" maxWidth={860} gap={5}>
        {caption ? (
          <Section variant="section" padding={5}>
            <VStack gap={4}>
              <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
                <VStack gap={0.5}>
                  <Heading level={2}>Vietnamese caption</Heading>
                  <Text type="supporting" color="secondary">
                    Review và edit trước khi publish.
                  </Text>
                </VStack>
                <HStack gap={2} wrap="wrap">
                  {model ? <Token label={model} size="sm" color="gray" /> : null}
                  <Text
                    type="supporting"
                    color={overLimit ? "accent" : "secondary"}
                    hasTabularNumbers
                  >
                    {stats.bodyWords !== null ? `${stats.bodyWords} body words · ` : ""}
                    {stats.characters} characters
                  </Text>
                </HStack>
              </HStack>
              <TextArea
                label="Generated Vietnamese caption"
                isLabelHidden
                value={caption}
                rows={24}
                hasSpellCheck={false}
                status={
                  overLimit
                    ? {
                        type: "error",
                        message: "Body vượt giới hạn tối đa 200 từ.",
                      }
                    : undefined
                }
                onChange={(value) => updateSession({ caption: value })}
              />
              <HStack gap={3} wrap="wrap">
                <CopyCaptionButton caption={caption} />
              </HStack>
            </VStack>
          </Section>
        ) : (
          <VStack minHeight={480} hAlign="center" vAlign="center">
            <EmptyState
              headingLevel={2}
              title="Paste an article to start"
              description="Điền headline, source và full article text. Caption tiếng Việt sẽ xuất hiện tại đây."
              icon={<FileText size={32} />}
            />
          </VStack>
        )}
      </VStack>
    </VStack>
  );

  if (!isDesktop) {
    return (
      <VStack minHeight={640} gap={0}>
        {inputPanel}
        {caption ? outputPanel : null}
      </VStack>
    );
  }

  return (
    <Layout
      height="fill"
      start={
        <LayoutPanel
          width={520}
          padding={0}
          hasDivider
          label="Manual article input"
        >
          {inputPanel}
        </LayoutPanel>
      }
    >
      <LayoutContent padding={0} label="Manual caption output">
        {outputPanel}
      </LayoutContent>
    </Layout>
  );
}
