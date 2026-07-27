"use client";

import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { freshness, type FreshnessTier } from "@/lib/freshness";
import type { NewsItem } from "@/lib/types";

interface FeedBoardProps {
  items: NewsItem[];
  selectedId: string | null;
  onSelect: (item: NewsItem) => void;
  loading: boolean;
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <ListItem
      startContent={<Skeleton width={22} height={18} index={index} />}
      label={<Skeleton width="86%" height={16} index={index} />}
      description={<Skeleton width="48%" height={12} index={index} />}
      endContent={<Skeleton width={56} height={48} radius={2} index={index} />}
    />
  );
}

const STATUS_VARIANT: Record<
  FreshnessTier,
  "accent" | "success" | "warning" | "neutral"
> = {
  purple: "accent",
  green: "success",
  yellow: "warning",
  grey: "neutral",
};

export default function FeedBoard({
  items,
  selectedId,
  onSelect,
  loading,
}: FeedBoardProps) {
  if (loading && items.length === 0) {
    return (
      <List density="balanced" hasDividers aria-busy="true" aria-label="Đang tải tin">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonRow key={i} index={i} />
        ))}
      </List>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        isCompact
        title="Chưa có tin trong hàng đợi"
        description="Bật ít nhất một nguồn ở phía trên hoặc thử làm mới bảng tin."
      />
    );
  }

  return (
    <List density="balanced" hasDividers aria-label="Tin motorsport mới nhất">
      {items.map((item, index) => {
        const fresh = freshness(item.publishedAt);

        return (
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
              <HStack gap={1} vAlign="center" wrap="wrap">
                <Text type="supporting" color="secondary">
                  {item.sourceName}
                </Text>
                <StatusDot
                  variant={STATUS_VARIANT[fresh.tier]}
                  label={fresh.description}
                  tooltip={fresh.description}
                />
                <Text type="supporting" color="secondary" hasTabularNumbers>
                    {fresh.label}
                </Text>
              </HStack>
            }
            endContent={
              <Thumbnail
                src={item.imageUrl ?? undefined}
                alt={item.imageUrl ? `Ảnh minh hoạ: ${item.title}` : undefined}
                label={item.title}
              />
            }
          />
        );
      })}
    </List>
  );
}
