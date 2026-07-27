"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  FileText,
  Moon,
  Newspaper,
  RefreshCw,
  Sun,
} from "lucide-react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import {
  Layout,
  LayoutContent,
  LayoutPanel,
} from "@astryxdesign/core/Layout";
import { Section } from "@astryxdesign/core/Section";
import { StackItem } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { VStack } from "@astryxdesign/core/VStack";
import Composer from "./Composer";
import FeedBoard from "./FeedBoard";
import ManualArticleWorkspace from "./ManualArticleWorkspace";
import SourcePicker from "./SourcePicker";
import { sumWorkspaceTheme } from "@/theme/sum-theme.ts/sum-workspace";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  updatePreferences,
  type Preferences,
} from "@/lib/preferences";
import type {
  DraftContent,
  NewsItem,
  PostSettings,
  Source,
  SourceId,
} from "@/lib/types";

interface GeneratedPost {
  caption: string;
  draft: DraftContent | null;
  model: string | null;
}

interface WorkbenchProps {
  sources: Source[];
  defaultSourceIds: SourceId[];
}

interface FeedResponse {
  items: NewsItem[];
  errors: { sourceId: SourceId; sourceName: string; message: string }[];
  fetchedAt: string;
  error?: string;
}

type WorkspaceTab = "feed" | "manual";

/** Pure fetch — never touches state, so the effect below stays side-effect free. */
async function fetchFeed(
  sourceIds: SourceId[],
  forceFresh: boolean,
): Promise<FeedResponse> {
  if (sourceIds.length === 0) {
    return { items: [], errors: [], fetchedAt: new Date().toISOString() };
  }
  const refreshParam = forceFresh ? "&refresh=1" : "";
  const response = await fetch(
    `/api/feed?limit=25&sources=${sourceIds.join(",")}${refreshParam}`,
    { cache: "no-store" },
  );
  const data = (await response.json()) as FeedResponse;
  if (!response.ok) throw new Error(data.error ?? "Không load được News Feed.");
  return data;
}

export default function Workbench({ sources, defaultSourceIds }: WorkbenchProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const prefs = useSyncExternalStore(
    subscribe,
    () => getSnapshot(defaultSourceIds),
    () => getServerSnapshot(defaultSourceIds),
  );

  const [items, setItems] = useState<NewsItem[]>([]);
  const [feedErrors, setFeedErrors] = useState<FeedResponse["errors"]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("feed");

  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState<DraftContent | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  /**
   * Generated captions, keyed by story id, kept for the session. Switching
   * stories and coming back must not cost a second model call — only the
   * explicit "Soạn lại" button re-spends.
   */
  const [generated, setGenerated] = useState<Record<string, GeneratedPost>>({});

  // Joined rather than passed as an array so the effect compares by value.
  const sourcesKey = prefs.sources.join(",");

  useEffect(() => {
    let cancelled = false;
    const sourceIds = sourcesKey ? (sourcesKey.split(",") as SourceId[]) : [];

    void (async () => {
      try {
        const data = await fetchFeed(sourceIds, refreshNonce > 0);
        if (cancelled) return;
        setItems(data.items);
        setFeedErrors(data.errors ?? []);
        setFetchedAt(data.fetchedAt);
        setFeedError(null);
      } catch (error) {
        if (cancelled) return;
        setFeedError(
          error instanceof Error ? error.message : "Không load được News Feed.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourcesKey, refreshNonce]);

  const savePrefs = useCallback((next: Preferences) => updatePreferences(next), []);

  const toggleSource = useCallback(
    (id: SourceId) => {
      const next = prefs.sources.includes(id)
        ? prefs.sources.filter((s) => s !== id)
        : [...prefs.sources, id];
      setLoading(true);
      savePrefs({ ...prefs, sources: next });
    },
    [prefs, savePrefs],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshNonce((n) => n + 1);
  }, []);

  const setSettings = useCallback(
    (settings: PostSettings) => savePrefs({ ...prefs, settings }),
    [prefs, savePrefs],
  );

  const setIncludeSourceUrl = useCallback(
    (includeSourceUrl: boolean) => savePrefs({ ...prefs, includeSourceUrl }),
    [prefs, savePrefs],
  );

  const toggleTheme = useCallback(
    () =>
      savePrefs({
        ...prefs,
        themeMode: prefs.themeMode === "dark" ? "light" : "dark",
      }),
    [prefs, savePrefs],
  );

  const selectItem = useCallback(
    (item: NewsItem) => {
      setSelected(item);
      setGenerateError(null);

      // Restore a caption already paid for this session rather than clearing it.
      const previous = generated[item.id];
      setCaption(previous?.caption ?? "");
      setDraft(previous?.draft ?? null);
      setModel(previous?.model ?? null);
      setFromCache(Boolean(previous));
    },
    [generated],
  );

  const generate = useCallback(async () => {
    if (!selected) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          sources: prefs.sources,
          settings: prefs.settings,
          includeSourceUrl: prefs.includeSourceUrl,
          extraInstructions,
        }),
      });
      const data = (await response.json()) as {
        caption?: string;
        draft?: DraftContent;
        model?: string;
        error?: string;
      };
      if (!response.ok || !data.caption) {
        throw new Error(data.error ?? "Generate caption thất bại.");
      }
      const post: GeneratedPost = {
        caption: data.caption,
        draft: data.draft ?? null,
        model: data.model ?? null,
      };
      setCaption(post.caption);
      setDraft(post.draft);
      setModel(post.model);
      setFromCache(false);
      setGenerated((current) => ({ ...current, [selected.id]: post }));
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Generate caption thất bại.",
      );
    } finally {
      setGenerating(false);
    }
  }, [selected, prefs, extraInstructions]);

  /** Keep admin edits with the story, so switching away does not lose them. */
  const editCaption = useCallback(
    (value: string) => {
      setCaption(value);
      if (!selected) return;
      setGenerated((current) => {
        const existing = current[selected.id];
        if (!existing) return current;
        return { ...current, [selected.id]: { ...existing, caption: value } };
      });
    },
    [selected],
  );

  const updatedLabel = useMemo(() => {
    if (!fetchedAt) return null;
    return new Date(fetchedAt).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [fetchedAt]);

  const feedContent = (
    <VStack height="100%" gap={0}>
      <Toolbar
        label="News Feed controls"
        size="md"
        variant="section"
        startContent={
          <VStack gap={0}>
            <Heading level={1}>News Feed</Heading>
            <Text type="supporting" color="secondary">
              25 latest motorsport stories
              {updatedLabel ? ` · updated ${updatedLabel}` : ""}
            </Text>
          </VStack>
        }
        endContent={
          <Button
            label="Refresh"
            variant="ghost"
            icon={<RefreshCw size={16} aria-hidden />}
            isIconOnly={!isDesktop}
            isLoading={loading}
            isDisabled={loading}
            onClick={refresh}
          />
        }
      />

      <SourcePicker
        sources={sources}
        enabled={prefs.sources}
        onToggle={toggleSource}
      />

      {feedError ? (
        <Banner
          status="error"
          container="section"
          title="Không load được News Feed"
          description={feedError}
        />
      ) : null}

      {feedErrors.length > 0 ? (
        <Banner
          status="warning"
          container="section"
          title="Một số sources đang gián đoạn"
          description={feedErrors.map((item) => item.sourceName).join(", ")}
        />
      ) : null}

      <StackItem size="fill" isScrollable>
        <FeedBoard
          items={items}
          selectedId={selected?.id ?? null}
          onSelect={selectItem}
          loading={loading}
        />
      </StackItem>
    </VStack>
  );

  const composer = (
    <Composer
      item={selected}
      caption={caption}
      draft={draft}
      cached={fromCache}
      onCaptionChange={editCaption}
      settings={prefs.settings}
      onSettingsChange={setSettings}
      includeSourceUrl={prefs.includeSourceUrl}
      onIncludeSourceUrlChange={setIncludeSourceUrl}
      extraInstructions={extraInstructions}
      onExtraInstructionsChange={setExtraInstructions}
      onGenerate={generate}
      generating={generating}
      error={generateError}
      model={model}
    />
  );

  const feedWorkspace = isDesktop ? (
    <Layout
      height="fill"
      start={
        <LayoutPanel
          width={400}
          padding={0}
          hasDivider
          label="Latest News Feed"
        >
          {feedContent}
        </LayoutPanel>
      }
    >
      <LayoutContent padding={0} label="Caption workspace">
        {composer}
      </LayoutContent>
    </Layout>
  ) : selected ? (
    <VStack gap={0}>
      <Section variant="muted" padding={2} dividers={["bottom"]}>
        <Button
          label="Back to News Feed"
          variant="ghost"
          icon={<ArrowLeft size={16} aria-hidden />}
          onClick={() => setSelected(null)}
        />
      </Section>
      {composer}
    </VStack>
  ) : (
    <VStack minHeight={640}>{feedContent}</VStack>
  );

  const workspaceContent =
    workspaceTab === "manual" ? (
      <ManualArticleWorkspace
        isDesktop={isDesktop}
        settings={prefs.settings}
        includeSourceUrl={prefs.includeSourceUrl}
        onIncludeSourceUrlChange={setIncludeSourceUrl}
      />
    ) : (
      feedWorkspace
    );

  const workspaceTabs = (
    <TabList
      value={workspaceTab}
      onChange={(value) => setWorkspaceTab(value as WorkspaceTab)}
      layout={isDesktop ? "hug" : "fill"}
      hasDivider
    >
      <Tab
        value="feed"
        label="News Feed"
        icon={<Newspaper size={16} aria-hidden />}
      />
      <Tab
        value="manual"
        label="Manual Article"
        icon={<FileText size={16} aria-hidden />}
      />
    </TabList>
  );

  return (
    <Theme theme={sumWorkspaceTheme} mode={prefs.themeMode}>
      <AppShell
        height={isDesktop ? "fill" : "auto"}
        variant="section"
        contentPadding={0}
        topNav={
          <TopNav
            label="SUM Editorial navigation"
            heading={
              <TopNavHeading
                logo={
                  <Image
                    src="/sum-logo.png"
                    alt=""
                    width={104}
                    height={52}
                    sizes="104px"
                  />
                }
                heading="Editorial"
                headingHref="/"
              />
            }
            endContent={
              <HStack gap={1.5} vAlign="center">
                <Button
                  label={
                    prefs.themeMode === "dark"
                      ? "Switch to light mode"
                      : "Switch to dark mode"
                  }
                  variant="ghost"
                  icon={
                    prefs.themeMode === "dark" ? (
                      <Sun size={16} aria-hidden />
                    ) : (
                      <Moon size={16} aria-hidden />
                    )
                  }
                  isIconOnly
                  onClick={toggleTheme}
                />
                <StatusDot
                  variant={feedError ? "error" : loading ? "warning" : "success"}
                  label={
                    feedError
                      ? "Source error"
                      : loading
                        ? "Đang sync sources"
                        : "Sources online"
                  }
                />
                <Text type="supporting" color="secondary">
                  {prefs.sources.length} sources
                </Text>
              </HStack>
            }
          />
        }
      >
        {isDesktop ? (
          <VStack height="100%" gap={0}>
            {workspaceTabs}
            <StackItem size="fill">{workspaceContent}</StackItem>
          </VStack>
        ) : (
          <VStack minHeight={640} gap={0}>
            {workspaceTabs}
            {workspaceContent}
          </VStack>
        )}
      </AppShell>
    </Theme>
  );
}
