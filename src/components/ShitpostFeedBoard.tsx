"use client";

import { Heart, MessageCircle, Play, Repeat2 } from "lucide-react";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { Token } from "@astryxdesign/core/Token";
import type { ShitpostItem } from "@/lib/types";

interface ShitpostFeedBoardProps {
  items: ShitpostItem[];
  selectedId: string | null;
  onSelect: (item: ShitpostItem) => void;
  loading: boolean;
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <ListItem
      startContent={<Skeleton width={22} height={18} index={index} />}
      label={<Skeleton width="84%" height={16} index={index} />}
      description={<Skeleton width="54%" height={12} index={index} />}
      endContent={<Skeleton width={56} height={48} radius={2} index={index} />}
    />
  );
}

export default function ShitpostFeedBoard({
  items,
  selectedId,
  onSelect,
  loading,
}: ShitpostFeedBoardProps) {
  if (loading && items.length === 0) {
    return (
      <List
        density="spacious"
        hasDividers
        aria-busy="true"
        aria-label="Đang load Shitpost Feed"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <SkeletonRow key={index} index={index} />
        ))}
      </List>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        isCompact
        title="Shitpost Feed đang trống"
        description="Thử Refresh hoặc mở rộng Bluesky search terms."
      />
    );
  }

  return (
    <List density="spacious" hasDividers aria-label="Viral automotive Bluesky posts">
      {items.map((item, index) => (
        <ListItem
          key={item.id}
          isSelected={item.id === selectedId}
          onClick={() => onSelect(item)}
          startContent={
            <Text type="code" color="secondary" hasTabularNumbers>
              {String(index + 1).padStart(2, "0")}
            </Text>
          }
          label={
            <Text type="body" weight="medium" display="block" maxLines={2}>
              {item.title}
            </Text>
          }
          description={
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text type="supporting" color="secondary">
                @{item.authorHandle}
              </Text>
              <HStack gap={0.5} vAlign="center">
                <Heart size={14} aria-hidden />
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {compactNumber(item.likeCount)}
                </Text>
              </HStack>
              <HStack gap={0.5} vAlign="center">
                <Repeat2 size={14} aria-hidden />
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {compactNumber(item.repostCount)}
                </Text>
              </HStack>
              <HStack gap={0.5} vAlign="center">
                <MessageCircle size={14} aria-hidden />
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {compactNumber(item.commentCount)}
                </Text>
              </HStack>
              {item.mediaType === "video" ? (
                <Token label="Video" size="sm" color="blue" icon={<Play size={12} />} />
              ) : null}
            </HStack>
          }
          endContent={
            <Thumbnail
              src={item.imageUrl ?? undefined}
              alt={item.imageUrl ? `Bluesky post preview: ${item.title}` : undefined}
              label={item.title}
            />
          }
        />
      ))}
    </List>
  );
}
