"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  Copy,
  FlagTriangleRight,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
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
import { Token } from "@astryxdesign/core/Token";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { VStack } from "@astryxdesign/core/VStack";

const MIN_CONTEXT_CHARS = 10;
const MAX_CONTEXT_CHARS = 12_000;

const STARTERS = [
  {
    label: "Qualifying results",
    icon: <Trophy size={16} aria-hidden />,
    value:
      "Hãy làm cho tôi một caption để thông báo kết quả vòng loại SOS. Season: [điền]. Track: [điền]. Top 3 và lap time: [dán dữ liệu tại đây].",
  },
  {
    label: "Test Race schedule",
    icon: <CalendarClock size={16} aria-hidden />,
    value:
      "Hãy cho tôi caption để thông báo lịch Test Race SOS tại Laguna Seca. Season: [điền]. Ngày, giờ check-in, qualifying, race start, server và pass: [dán thông tin tại đây].",
  },
  {
    label: "Race results",
    icon: <FlagTriangleRight size={16} aria-hidden />,
    value:
      "Hãy làm caption công bố kết quả chặng đua SOS. Round và track: [điền]. Podium từng hạng PRO, AM, JR và các điểm thưởng: [dán kết quả tại đây].",
  },
] as const;

interface SosGenerateResponse {
  caption?: string;
  model?: string;
  cached?: boolean;
  error?: string;
}

interface SosSessionState {
  context: string;
  caption: string;
  model: string | null;
  cached: boolean;
}

let sosSessionState: SosSessionState = {
  context: "",
  caption: "",
  model: null,
  cached: false,
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
      timer.current = setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      label={copied ? "Copied" : "Copy caption"}
      variant={copied ? "secondary" : "primary"}
      icon={
        copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />
      }
      onClick={copy}
    />
  );
}

export default function SosCaptionWorkspace({
  isDesktop,
}: {
  isDesktop: boolean;
}) {
  const [session, setSession] = useState<SosSessionState>(() => sosSessionState);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { context, caption, model, cached } = session;

  function updateSession(patch: Partial<SosSessionState>) {
    setSession((current) => {
      const next = { ...current, ...patch };
      sosSessionState = next;
      return next;
    });
  }

  const contextLength = context.trim().length;
  const canGenerate =
    contextLength >= MIN_CONTEXT_CHARS &&
    contextLength <= MAX_CONTEXT_CHARS &&
    !generating;
  const captionWords = caption.trim()
    ? caption.trim().split(/\s+/).filter(Boolean).length
    : 0;

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          forceRegenerate: Boolean(caption),
        }),
      });
      const data = (await response.json()) as SosGenerateResponse;
      if (!response.ok || !data.caption) {
        throw new Error(data.error ?? "Không thể generate SOS caption.");
      }
      updateSession({
        caption: data.caption,
        model: data.model ?? null,
        cached: data.cached === true,
      });
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Không thể generate SOS caption.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const inputPanel = (
    <VStack height={isDesktop ? "100%" : undefined} gap={0}>
      <Toolbar
        label="SOS caption controls"
        size="lg"
        gap={3}
        variant="section"
        startContent={
          <VStack gap={0.5}>
            <Heading level={1}>SOS Caption Generator</Heading>
            <Text type="supporting" color="secondary">
              SUM Open Series · Assetto Corsa Competizione
            </Text>
          </VStack>
        }
      />

      <StackItem size={isDesktop ? "fill" : undefined} isScrollable={isDesktop}>
        <VStack gap={5} padding={5}>
          <Section variant="muted" padding={4}>
            <VStack gap={1}>
              <Text type="label">Brief in, Facebook caption out</Text>
              <Text type="supporting" color="secondary">
                Viết yêu cầu tự nhiên bằng tiếng Việt hoặc English. Dán đầy đủ
                tên tay đua, lap time, track, ngày giờ và server details nếu có;
                tool sẽ dùng placeholder thay vì tự bịa dữ liệu còn thiếu.
              </Text>
            </VStack>
          </Section>

          <Section variant="transparent" padding={0}>
            <VStack gap={3}>
              <VStack gap={0.5}>
                <Heading level={3}>Quick starters</Heading>
                <Text type="supporting" color="secondary">
                  Chọn một template rồi thay phần trong ngoặc vuông bằng dữ liệu thật.
                </Text>
              </VStack>
              <HStack gap={2} wrap="wrap">
                {STARTERS.map((starter) => (
                  <Button
                    key={starter.label}
                    label={starter.label}
                    variant="secondary"
                    icon={starter.icon}
                    onClick={() => {
                      updateSession({ context: starter.value });
                      setError(null);
                    }}
                  />
                ))}
              </HStack>
            </VStack>
          </Section>

          <FormLayout direction="vertical">
            <TextArea
              label="Yêu cầu và context"
              isRequired
              value={context}
              rows={isDesktop ? 16 : 12}
              maxLength={MAX_CONTEXT_CHARS}
              placeholder="Ví dụ: Hãy làm caption thông báo lịch Test Race SOS tại Laguna Seca vào 20h ngày 15/10…"
              description="Càng đủ dữ liệu, caption càng sẵn sàng để đăng. Không có dữ liệu thì tool sẽ để placeholder rõ ràng."
              status={
                context.length > 0 && contextLength < MIN_CONTEXT_CHARS
                  ? {
                      type: "warning",
                      message: `Cần ít nhất ${MIN_CONTEXT_CHARS} characters để mô tả yêu cầu.`,
                    }
                  : contextLength > MAX_CONTEXT_CHARS
                    ? {
                        type: "error",
                        message: `Context vượt giới hạn ${MAX_CONTEXT_CHARS.toLocaleString()} characters.`,
                      }
                    : undefined
              }
              onChange={(value) => updateSession({ context: value })}
            />
          </FormLayout>

          {error ? (
            <Banner
              status="error"
              title="Không thể generate SOS caption"
              description={error}
            />
          ) : null}

          <Button
            label={caption ? "Regenerate SOS caption" : "Generate SOS caption"}
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
                  <Heading level={2}>SOS Facebook caption</Heading>
                  <Text type="supporting" color="secondary">
                    Review placeholders, edit nếu cần, rồi copy để publish.
                  </Text>
                </VStack>
                <HStack gap={2} wrap="wrap" vAlign="center">
                  <Token label="SUM Open Series" size="sm" color="green" />
                  {cached ? (
                    <Token label="30-day cache" size="sm" color="green" />
                  ) : null}
                  {model ? <Token label={model} size="sm" color="gray" /> : null}
                  <Text type="supporting" color="secondary" hasTabularNumbers>
                    {captionWords} words · {caption.length} characters
                  </Text>
                </HStack>
              </HStack>

              <TextArea
                label="Generated SOS caption"
                isLabelHidden
                value={caption}
                rows={26}
                hasSpellCheck={false}
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
              title="Build an SOS announcement"
              description="Nhập brief cho Qualifying, Test Race, race results, driver lineup hoặc season launch. Caption hoàn chỉnh sẽ xuất hiện tại đây."
              icon={<Trophy size={32} />}
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
          label="SOS caption input"
        >
          {inputPanel}
        </LayoutPanel>
      }
    >
      <LayoutContent padding={0} label="SOS caption output">
        {outputPanel}
      </LayoutContent>
    </Layout>
  );
}
