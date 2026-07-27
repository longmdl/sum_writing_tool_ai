"use client";

import { AlertTriangle } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { HStack } from "@astryxdesign/core/HStack";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
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
  const hasRestrictedSource = enabled.some(
    (id) => sources.find((source) => source.id === id)?.policy.blocksAiCrawlers,
  );

  return (
    <Section variant="muted" padding={3} dividers={["bottom"]}>
      <HStack gap={1.5} wrap="wrap" vAlign="center">
        <Text type="label" color="secondary">
          Sources
        </Text>
        {sources.map((source) => {
          const isEnabled = enabled.includes(source.id);
          const restricted = source.policy.blocksAiCrawlers;

          return (
            <Token
              key={source.id}
              label={source.name}
              size="sm"
              color={isEnabled ? "green" : "gray"}
              icon={restricted ? <AlertTriangle size={14} aria-hidden /> : undefined}
              description={`${isEnabled ? "Enabled" : "Disabled"}. ${source.policy.note}`}
              onClick={() => onToggle(source.id)}
            />
          );
        })}
      </HStack>

      {hasRestrictedSource ? (
        <Banner
          status="warning"
          title="Một số sources giới hạn AI usage"
          description="Tool chỉ dùng RSS excerpt để tham khảo và luôn giữ dòng Nguồn: trong bài đăng."
        />
      ) : null}
    </Section>
  );
}
