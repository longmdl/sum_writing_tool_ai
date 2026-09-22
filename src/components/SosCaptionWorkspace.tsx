"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpenCheck,
  CalendarClock,
  Check,
  Copy,
  FlagTriangleRight,
  Gauge,
  Gift,
  Globe2,
  MapPinned,
  Megaphone,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
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
import { Token } from "@astryxdesign/core/Token";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { VStack } from "@astryxdesign/core/VStack";

const MIN_CONTEXT_CHARS = 10;
const MAX_CONTEXT_CHARS = 12_000;

const STARTERS = [
  {
    label: "Season launch",
    icon: <Megaphone size={16} aria-hidden />,
    value:
      "Hãy viết caption chính thức khởi động mùa giải SOS mới. Season: [điền]. Hãy trình bày các thay đổi về hạng PRO/AM/JR, thể thức tính điểm, số chặng, lịch Qualifying, link điều lệ và link đăng ký từ dữ liệu tôi cung cấp hoặc live SOS data nếu bật.",
  },
  {
    label: "Qualifying update",
    icon: <Gauge size={16} aria-hidden />,
    value:
      "Hãy viết Nhật ký Qualifying SOS mới nhất. Nếu live SOS data đang bật, dùng đúng số tay đua tham gia, fastest lap từng track và top 3 hiện tại. Giữ nguyên tên, lap time và điểm; không tự bịa dữ liệu còn thiếu.",
  },
  {
    label: "Qualifying results",
    icon: <Trophy size={16} aria-hidden />,
    value:
      "Hãy viết caption công bố kết quả Qualifying SOS. Season và Qualifying round: [điền]. Dùng đúng thứ tự tay đua, lap time, tổng điểm và trạng thái qualified từ brief hoặc live SOS data nếu bật. Nêu rõ bước tiếp theo của mùa giải nếu có.",
  },
  {
    label: "Circuit preview",
    icon: <MapPinned size={16} aria-hidden />,
    value:
      "Hãy viết caption giới thiệu chặng đua SOS sắp tới. Round: [điền]. Track: [điền]. Bối cảnh mùa giải, đặc điểm track, thử thách, ngày giờ, format và livestream: [dán dữ liệu tại đây]. Chỉ dùng circuit facts được cung cấp.",
  },
  {
    label: "Track guide",
    icon: <BookOpenCheck size={16} aria-hidden />,
    value:
      "Hãy viết caption Track Guide SOS cho [track]. Các corner, braking point, kỹ thuật, setup note và video guide: [dán dữ liệu tại đây]. Kết bài bằng thông tin chặng đua đã được xác nhận; không lấy nhầm chi tiết từ track khác.",
  },
  {
    label: "Test Race schedule",
    icon: <CalendarClock size={16} aria-hidden />,
    value:
      "Hãy cho tôi caption để thông báo lịch Test Race SOS tại Laguna Seca. Season: [điền]. Ngày, giờ check-in, qualifying, race start, server và pass: [dán thông tin tại đây].",
  },
  {
    label: "Driver lineup",
    icon: <UsersRound size={16} aria-hidden />,
    value:
      "Hãy viết caption công bố danh sách tay đua chính thức của SOS. Season và số lượng tay đua: [điền]. Danh sách theo hạng PRO/AM/JR hoặc thông tin trên poster: [dán tại đây]. Nếu danh sách đã nằm trên poster, giữ caption ngắn gọn và mời khán giả xem graphic.",
  },
  {
    label: "Race results",
    icon: <FlagTriangleRight size={16} aria-hidden />,
    value:
      "Hãy làm caption công bố kết quả chặng đua SOS. Round và track: [điền]. Podium từng hạng PRO, AM, JR và các điểm thưởng: [dán kết quả tại đây].",
  },
  {
    label: "Prizes & sponsors",
    icon: <Gift size={16} aria-hidden />,
    value:
      "Hãy viết caption công bố giải thưởng và cảm ơn nhà tài trợ cho SOS. Season: [điền]. Liệt kê chính xác từng phần thưởng, giá trị, điều kiện nhận, hạng đấu và nhà tài trợ: [dán dữ liệu tại đây].",
  },
  {
    label: "Rules update",
    icon: <BookOpenCheck size={16} aria-hidden />,
    value:
      "Hãy viết caption thông báo điều lệ hoặc vận hành SOS. Nội dung thay đổi, hành động tay đua phải thực hiện, deadline, link điều lệ và yêu cầu Discord: [dán dữ liệu tại đây]. Giữ giọng văn rõ ràng, chính thức và không thêm quy định cũ.",
  },
] as const;

interface SosGenerateResponse {
  caption?: string;
  model?: string;
  cached?: boolean;
  sourceContext?: SosSourceContext;
  error?: string;
}

interface SosSourceContext {
  status: "live" | "stale" | "unavailable" | "disabled";
  sourceUrl: string;
  fetchedAt: string | null;
  sourceUpdatedAt: string | null;
  seasonName: string | null;
  participantCount: number;
  qualifyingRoundCount: number;
  mainRoundCount: number;
  completedRoundCount: number;
  scrapedRoundCount: number;
}

interface SosSessionState {
  context: string;
  useLiveData: boolean;
  caption: string;
  model: string | null;
  cached: boolean;
  sourceContext: SosSourceContext | null;
}

let sosSessionState: SosSessionState = {
  context: "",
  useLiveData: true,
  caption: "",
  model: null,
  cached: false,
  sourceContext: null,
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
  const { context, useLiveData, caption, model, cached, sourceContext } = session;

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
          useLiveData,
          forceRegenerate: Boolean(caption),
        }),
      });
      const data = (await response.json()) as SosGenerateResponse;
      if (data.sourceContext) {
        updateSession({ sourceContext: data.sourceContext });
      }
      if (!response.ok || !data.caption) {
        throw new Error(data.error ?? "Không thể generate SOS caption.");
      }
      updateSession({
        caption: data.caption,
        model: data.model ?? null,
        cached: data.cached === true,
        sourceContext: data.sourceContext ?? null,
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
                tên tay đua, lap time, track, ngày giờ và server details nếu có.
                Bật live data để cross-check sos.sumracing.vn; dữ liệu chưa có
                sẽ được giữ bằng placeholder rõ ràng.
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
            <CheckboxInput
              label="Use live SOS data"
              description={
                useLiveData
                  ? "Cross-check season, participants, Qualifying, calendar and available results from sos.sumracing.vn."
                  : "Generate only from the brief above; no SOS website request will be made."
              }
              value={useLiveData}
              onChange={(value) =>
                updateSession({ useLiveData: value, sourceContext: null })
              }
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
                  {sourceContext ? (
                    <Token
                      label={
                        sourceContext.status === "live"
                          ? "Live SOS data"
                          : sourceContext.status === "stale"
                            ? "Stale SOS data"
                            : sourceContext.status === "disabled"
                              ? "Live data off"
                              : "Brief only"
                      }
                      size="sm"
                      color={
                        sourceContext.status === "live"
                          ? "green"
                          : sourceContext.status === "stale"
                            ? "yellow"
                            : "gray"
                      }
                      icon={<Globe2 size={14} aria-hidden />}
                      description={
                        sourceContext.status === "disabled"
                          ? "Generated from the editor brief only"
                          : "Public context from sos.sumracing.vn"
                      }
                    />
                  ) : null}
                  {model ? <Token label={model} size="sm" color="gray" /> : null}
                  <Text type="supporting" color="secondary" hasTabularNumbers>
                    {captionWords} words · {caption.length} characters
                  </Text>
                </HStack>
              </HStack>

              {sourceContext &&
              (sourceContext.status === "live" ||
                sourceContext.status === "stale") ? (
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  Context: {sourceContext.participantCount} drivers ·{" "}
                  {sourceContext.qualifyingRoundCount} qualifying tracks ·{" "}
                  {sourceContext.scrapedRoundCount} result rounds
                </Text>
              ) : null}

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
