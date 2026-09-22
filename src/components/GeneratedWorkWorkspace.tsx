"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Database,
  ExternalLink,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import {
  Layout,
  LayoutContent,
  LayoutPanel,
} from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { StackItem } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Token } from "@astryxdesign/core/Token";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { VStack } from "@astryxdesign/core/VStack";
import type { GeneratedPostRecord } from "@/lib/generated-posts";

interface GeneratedPostsResponse {
  posts: GeneratedPostRecord[];
  status: "hit" | "unavailable" | "error";
  retentionDays: number;
}

interface DeleteGeneratedPostResponse {
  deleted?: boolean;
  id?: string;
  error?: string;
}

interface GeneratedWorkWorkspaceProps {
  isDesktop: boolean;
}

async function fetchGeneratedPosts(): Promise<GeneratedPostsResponse> {
  const response = await fetch("/api/generated-posts?limit=200", {
    cache: "no-store",
  });
  const data = (await response.json()) as GeneratedPostsResponse;
  if (!response.ok) throw new Error("Archive request failed.");
  return data;
}

async function deleteGeneratedPost(
  id: string,
): Promise<DeleteGeneratedPostResponse> {
  const response = await fetch("/api/generated-posts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = (await response.json()) as DeleteGeneratedPostResponse;
  if (!response.ok || data.deleted !== true) {
    throw new Error(data.error ?? "Delete request failed.");
  }
  return data;
}

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
      icon={
        copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />
      }
      onClick={copy}
    />
  );
}

export default function GeneratedWorkWorkspace({
  isDesktop,
}: GeneratedWorkWorkspaceProps) {
  const [posts, setPosts] = useState<GeneratedPostRecord[]>([]);
  const [status, setStatus] =
    useState<GeneratedPostsResponse["status"]>("hit");
  const [retentionDays, setRetentionDays] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] =
    useState<GeneratedPostRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const applyPosts = useCallback(
    (data: GeneratedPostsResponse) => {
      setPosts(data.posts ?? []);
      setStatus(data.status);
      setRetentionDays(data.retentionDays ?? 30);
      setSelectedId((current) => {
        if (current && data.posts.some((post) => post.id === current)) {
          return current;
        }
        return isDesktop ? (data.posts[0]?.id ?? null) : null;
      });
    },
    [isDesktop],
  );

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      applyPosts(await fetchGeneratedPosts());
    } catch {
      setPosts([]);
      setStatus("error");
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [applyPosts]);

  useEffect(() => {
    let cancelled = false;

    void fetchGeneratedPosts()
      .then((data) => {
        if (!cancelled) applyPosts(data);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setStatus("error");
        setSelectedId(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyPosts]);

  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi-VN");
    if (!needle) return posts;
    return posts.filter((post) =>
      [post.title, post.sourceName, post.caption]
        .join("\n")
        .toLocaleLowerCase("vi-VN")
        .includes(needle),
    );
  }, [posts, query]);

  const selected =
    posts.find((post) => post.id === selectedId) ?? null;

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteGeneratedPost(deleteTarget.id);
      const deletedTitle = deleteTarget.title;
      const deletedIndex = posts.findIndex(
        (post) => post.id === deleteTarget.id,
      );
      const remaining = posts.filter((post) => post.id !== deleteTarget.id);

      setPosts(remaining);
      setSelectedId(
        isDesktop
          ? (remaining[
              Math.max(0, Math.min(deletedIndex, remaining.length - 1))
            ]?.id ?? null)
          : null,
      );
      setDeleteTarget(null);
      setDeleteSuccess(`Đã xoá “${deletedTitle}” khỏi cache.`);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Không thể xoá cached post này.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const archiveList = (
    <VStack height={isDesktop ? "100%" : undefined} gap={0}>
      <Toolbar
        label="Generated work controls"
        size="lg"
        gap={3}
        variant="section"
        startContent={
          <VStack gap={0.5}>
            <Heading level={1}>Generated Work</Heading>
            <Text type="supporting" color="secondary">
              {posts.length} cached posts · {retentionDays}-day retention
            </Text>
          </VStack>
        }
        endContent={
          <Button
            label="Refresh archive"
            variant="ghost"
            icon={<RefreshCw size={16} aria-hidden />}
            isIconOnly={!isDesktop}
            isLoading={loading}
            isDisabled={loading}
            onClick={loadPosts}
          />
        }
      />

      <Section variant="muted" padding={4} dividers={["bottom"]}>
        <TextInput
          label="Search generated work"
          isLabelHidden
          value={query}
          placeholder="Search title, source, or caption"
          startIcon={Search}
          hasClear
          onChange={setQuery}
        />
      </Section>

      {status === "unavailable" ? (
        <Banner
          status="warning"
          container="section"
          title="Database chưa được kết nối"
          description="Add SUPABASE_URL and SUPABASE_SECRET_KEY, then run the included migration to activate the 30-day archive."
        />
      ) : null}

      {status === "error" ? (
        <Banner
          status="error"
          container="section"
          title="Không load được Generated Work"
          description="Check the Supabase connection and generated_posts migration."
        />
      ) : null}

      {deleteSuccess ? (
        <Banner
          status="success"
          container="section"
          title="Cached post deleted"
          description={deleteSuccess}
          isDismissable
          onDismiss={() => setDeleteSuccess(null)}
        />
      ) : null}

      <StackItem size={isDesktop ? "fill" : undefined} isScrollable={isDesktop}>
        {loading ? (
          <VStack gap={4} padding={4}>
            {Array.from({ length: 6 }, (_, index) => (
              <VStack key={index} gap={2}>
                <Skeleton
                  height={18}
                  width={index % 2 === 0 ? "84%" : "72%"}
                  index={index}
                />
                <Skeleton height={14} width="46%" index={index + 1} />
              </VStack>
            ))}
          </VStack>
        ) : filteredPosts.length > 0 ? (
          <List
            density="spacious"
            hasDividers
            header={
              <Text type="label">
                {query ? `${filteredPosts.length} matching posts` : "Cached posts"}
              </Text>
            }
          >
            {filteredPosts.map((post) => (
              <ListItem
                key={post.id}
                label={post.title}
                description={
                  <HStack gap={1.5} wrap="wrap" vAlign="center">
                    <Text type="supporting" color="secondary">
                      {post.sourceName}
                    </Text>
                    <Text type="supporting" color="disabled">
                      ·
                    </Text>
                    <Timestamp value={post.createdAt} format="auto" />
                  </HStack>
                }
                startContent={
                  post.imageUrl ? (
                    <Thumbnail src={post.imageUrl} alt="" label={post.title} />
                  ) : (
                    <Database size={18} aria-hidden />
                  )
                }
                isSelected={post.id === selectedId}
                onClick={() => setSelectedId(post.id)}
              />
            ))}
          </List>
        ) : (
          <VStack padding={8}>
            <EmptyState
              headingLevel={2}
              title={query ? "No matching posts" : "No cached posts yet"}
              description={
                query
                  ? "Try a broader title, source, or caption search."
                  : "Generate from News Feed, Shitpost Feed, SOS, or Manual Article and it will appear here."
              }
              icon={<Database size={32} />}
            />
          </VStack>
        )}
      </StackItem>
    </VStack>
  );

  const archiveDetail = selected ? (
    <VStack hAlign="center" padding={6}>
      <VStack width="100%" maxWidth={860} gap={5}>
        <Section variant="muted" padding={5}>
          <VStack gap={4}>
            <HStack gap={2} wrap="wrap" vAlign="center">
              <Token
                label={
                  selected.origin === "manual"
                    ? selected.sourceName === "SUM Open Series"
                      ? "SOS Caption"
                      : "Manual Article"
                    : selected.sourceName.startsWith("Reddit ·")
                      ? "Shitpost Feed"
                      : "News Feed"
                }
                size="sm"
                color={
                  selected.sourceName === "SUM Open Series"
                    ? "green"
                    : selected.origin === "manual"
                      ? "blue"
                      : "green"
                }
              />
              <Token label={selected.sourceName} size="sm" color="gray" />
              {selected.model ? (
                <Token label={selected.model} size="sm" color="gray" />
              ) : null}
            </HStack>
            <Heading level={2}>{selected.title}</Heading>
            <HStack gap={3} wrap="wrap" vAlign="center">
              <Text type="supporting" color="secondary">
                Generated{" "}
                <Timestamp value={selected.createdAt} format="date_time" />
              </Text>
              <Text type="supporting" color="secondary">
                Expires{" "}
                <Timestamp value={selected.expiresAt} format="date_time" />
              </Text>
            </HStack>
            {selected.sourceUrl ? (
              <Button
                label="Open original"
                variant="secondary"
                icon={<ExternalLink size={16} aria-hidden />}
                href={selected.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            ) : null}
          </VStack>
        </Section>

        <Section variant="section" padding={5}>
          <VStack gap={4}>
            <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
              <VStack gap={0.5}>
                <Heading level={3}>Cached Facebook draft</Heading>
                <Text type="supporting" color="secondary">
                  Read-only snapshot from the generation time.
                </Text>
              </VStack>
              <HStack gap={2} wrap="wrap">
                <CopyCaptionButton caption={selected.caption} />
                <Button
                  label="Delete cached post"
                  variant="destructive"
                  icon={<Trash2 size={16} aria-hidden />}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(selected);
                  }}
                />
              </HStack>
            </HStack>
            <TextArea
              label="Cached caption"
              isLabelHidden
              value={selected.caption}
              rows={24}
              hasSpellCheck={false}
              isDisabled
              disabledMessage="Cached snapshots are read-only. Copy the caption to continue editing."
            />
          </VStack>
        </Section>
      </VStack>
    </VStack>
  ) : (
    <VStack minHeight={480} hAlign="center" vAlign="center" padding={8}>
      <EmptyState
        headingLevel={2}
        title="Choose a cached post"
        description="Select a generated caption to inspect, copy, or reopen its source."
        icon={<Database size={32} />}
      />
    </VStack>
  );

  const deleteDialog = (
    <AlertDialog
      isOpen={deleteTarget !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen && !deleting) {
          setDeleteTarget(null);
          setDeleteError(null);
        }
      }}
      title="Delete cached post?"
      description={
        deleteError ??
        `“${deleteTarget?.title ?? "This post"}” will be permanently removed from Generated Work. This cannot be undone.`
      }
      actionLabel="Delete cached post"
      cancelLabel="Cancel"
      isActionLoading={deleting}
      onAction={confirmDelete}
    />
  );

  if (!isDesktop) {
    return (
      <>
        {selected ? (
          <VStack minHeight={640} gap={0}>
            <Section variant="muted" padding={3} dividers={["bottom"]}>
              <Button
                label="Back to Generated Work"
                variant="ghost"
                icon={<ArrowLeft size={16} aria-hidden />}
                onClick={() => setSelectedId(null)}
              />
            </Section>
            {archiveDetail}
          </VStack>
        ) : (
          <VStack minHeight={640}>{archiveList}</VStack>
        )}
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <Layout
        height="fill"
        start={
          <LayoutPanel
            width={440}
            padding={0}
            hasDivider
            label="Cached generated posts"
          >
            {archiveList}
          </LayoutPanel>
        }
      >
        <LayoutContent padding={0} label="Cached post details">
          {archiveDetail}
        </LayoutContent>
      </Layout>
      {deleteDialog}
    </>
  );
}
