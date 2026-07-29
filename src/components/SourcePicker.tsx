"use client";

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
  return (
    <Section variant="muted" padding={4} dividers={["bottom"]}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Text type="label" color="secondary">
          Sources
        </Text>
        {sources.map((source) => {
          const isEnabled = enabled.includes(source.id);

          return (
            <Token
              key={source.id}
              label={source.shortName ?? source.name}
              size="md"
              color={isEnabled ? "green" : "gray"}
              description={isEnabled ? "Enabled" : "Disabled"}
              onClick={() => onToggle(source.id)}
            />
          );
        })}
      </HStack>
    </Section>
  );
}
