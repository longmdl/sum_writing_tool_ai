"use client";

import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { HStack } from "@astryxdesign/core/HStack";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
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
      <HStack gap={3} wrap="wrap" vAlign="center">
        <HStack gap={1.5} vAlign="center">
          <Text type="label" color="primary">
            Sources
          </Text>
          <Text type="supporting" color="disabled" hasTabularNumbers>
            {enabled.length}/{sources.length} active
          </Text>
        </HStack>
        {sources.map((source) => {
          const isEnabled = enabled.includes(source.id);

          return (
            <CheckboxInput
              key={source.id}
              label={source.shortName ?? source.name}
              size="sm"
              value={isEnabled}
              onChange={() => onToggle(source.id)}
            />
          );
        })}
      </HStack>
    </Section>
  );
}
