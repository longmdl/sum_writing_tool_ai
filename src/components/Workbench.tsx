"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Archive,
  FileText,
  Flame,
  Newspaper,
  RefreshCw,
  Trophy,
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
import GeneratedWorkWorkspace from "./GeneratedWorkWorkspace";
import ManualArticleWorkspace from "./ManualArticleWorkspace";
import ShitpostFeedBoard from "./ShitpostFeedBoard";
import SosCaptionWorkspace from "./SosCaptionWorkspace";
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
  ArticleInputSource,
  ArticleLengthGuide,
  DraftContent,
  FeedItem,
  NewsItem,
  PostSettings,
  Source,
  SourceId,
  ShitpostItem,
} from "@/lib/types";
import { isShitpostItem } from "@/lib/types";

interface GeneratedPost {
  caption: string;
  draft: DraftContent | null;
  model: string | null;
  inputSource: ArticleInputSource | null;
  lengthGuide: ArticleLengthGuide | null;
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

type WorkspaceTab = "feed" | "shitpost" | "sos" | "manual" | "generated";

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
    `/api/feed?limit=50&sources=${sourceIds.join(",")}${refreshParam}`,
    { cache: "no-store" },
  );
  const data = (await response.json()) as FeedResponse;
  if (!response.ok) throw new Error(data.error ?? "Không load được News Feed.");
  return data;
}

interface ShitpostFeedResponse {
  items: ShitpostItem[];
  communities: string[];
  fetchedAt: string;
  warning?: string;
  error?: string;
}

async function fetchShitpostFeed(forceFresh: boolean): Promise<ShitpostFeedResponse> {
  const refreshParam = forceFresh ? "?limit=50&refresh=1" : "?limit=50";
  const response = await fetch(`/api/shitposts${refreshParam}`, {
    cache: "no-store",
  });
  const data = (await response.json()) as ShitpostFeedResponse;
  if (!response.ok) throw new Error(data.error ?? "Không load được Shitpost Feed.");
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
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("feed");

  const [shitpostItems, setShitpostItems] = useState<ShitpostItem[]>([]);
  const [shitpostError, setShitpostError] = useState<string | null>(null);
  const [shitpostLoading, setShitpostLoading] = useState(false);
  const [shitpostLoaded, setShitpostLoaded] = useState(false);
  const [shitpostFetchedAt, setShitpostFetchedAt] = useState<string | null>(null);
  const [redditCommunities, setRedditCommunities] = useState<string[]>([]);
  const [shitpostWarning, setShitpostWarning] = useState<string | null>(null);

  const [selected, setSelected] = useState<FeedItem | null>(null);
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState<DraftContent | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [inputSource, setInputSource] =
    useState<ArticleInputSource | null>(null);
  const [lengthGuide, setLengthGuide] =
    useState<ArticleLengthGuide | null>(null);
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

  const loadShitposts = useCallback(async (forceFresh: boolean) => {
    try {
      const data = await fetchShitpostFeed(forceFresh);
      setShitpostItems(data.items);
      setRedditCommunities(data.communities);
      setShitpostWarning(data.warning ?? null);
      setShitpostFetchedAt(data.fetchedAt);
      setShitpostError(null);
      setShitpostLoaded(true);
    } catch (error) {
      setShitpostWarning(null);
      setShitpostError(
        error instanceof Error ? error.message : "Không load được Shitpost Feed.",
      );
      setShitpostLoaded(true);
    } finally {
      setShitpostLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workspaceTab !== "shitpost" || shitpostLoaded) return;
    let cancelled = false;

    void fetchShitpostFeed(false)
      .then((data) => {
        if (cancelled) return;
        setShitpostItems(data.items);
        setRedditCommunities(data.communities);
        setShitpostWarning(data.warning ?? null);
        setShitpostFetchedAt(data.fetchedAt);
        setShitpostError(null);
        setShitpostLoaded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setShitpostWarning(null);
        setShitpostError(
          error instanceof Error
            ? error.message
            : "Không load được Shitpost Feed.",
        );
        setShitpostLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setShitpostLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shitpostLoaded, workspaceTab]);

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

  const refreshShitposts = useCallback(() => {
    setShitpostLoading(true);
    void loadShitposts(true);
  }, [loadShitposts]);

  const setSettings = useCallback(
    (settings: PostSettings) => savePrefs({ ...prefs, settings }),
    [prefs, savePrefs],
  );

  const setIncludeSourceUrl = useCallback(
    (includeSourceUrl: boolean) => savePrefs({ ...prefs, includeSourceUrl }),
    [prefs, savePrefs],
  );

  const selectItem = useCallback(
    (item: FeedItem) => {
      setSelected(item);
      setGenerateError(null);

      // Restore a caption already paid for this session rather than clearing it.
      const previous = generated[item.id];
      setCaption(previous?.caption ?? "");
      setDraft(previous?.draft ?? null);
      setModel(previous?.model ?? null);
      setInputSource(previous?.inputSource ?? null);
      setLengthGuide(previous?.lengthGuide ?? null);
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
          forceRegenerate: Boolean(caption),
          feedKind: isShitpostItem(selected) ? "shitpost" : "news",
          item: isShitpostItem(selected) ? selected : undefined,
        }),
      });
      const data = (await response.json()) as {
        caption?: string;
        draft?: DraftContent;
        model?: string;
        inputSource?: ArticleInputSource;
        lengthGuide?: ArticleLengthGuide;
        cached?: boolean;
        error?: string;
      };
      if (!response.ok || !data.caption) {
        throw new Error(data.error ?? "Generate caption thất bại.");
      }
      const post: GeneratedPost = {
        caption: data.caption,
        draft: data.draft ?? null,
        model: data.model ?? null,
        inputSource: data.inputSource ?? null,
        lengthGuide: data.lengthGuide ?? null,
      };
      setCaption(post.caption);
      setDraft(post.draft);
      setModel(post.model);
      setInputSource(post.inputSource);
      setLengthGuide(post.lengthGuide);
      setFromCache(data.cached === true);
      setGenerated((current) => ({ ...current, [selected.id]: post }));
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Generate caption thất bại.",
      );
    } finally {
      setGenerating(false);
    }
  }, [selected, prefs, extraInstructions, caption]);

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

  const shitpostUpdatedLabel = useMemo(() => {
    if (!shitpostFetchedAt) return null;
    return new Date(shitpostFetchedAt).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [shitpostFetchedAt]);

  const feedContent = (
    <VStack height="100%" gap={0}>
      <Toolbar
        label="News Feed controls"
        size="lg"
        gap={3}
        variant="section"
        startContent={
          <VStack gap={0.5}>
            <Heading level={1}>News Feed</Heading>
            <Text type="supporting" color="secondary">
              50-story motorsport mix
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
      inputSource={inputSource}
      lengthGuide={lengthGuide}
    />
  );

  const shitpostContent = (
    <VStack height="100%" gap={0}>
      <Toolbar
        label="Shitpost Feed controls"
        size="lg"
        gap={3}
        variant="section"
        startContent={
          <VStack gap={0.5}>
            <Heading level={1}>Shitpost Feed</Heading>
            <Text type="supporting" color="secondary">
              Best-effort Reddit RSS
              {redditCommunities.length
                ? ` · ${redditCommunities.length} communities`
                : ""}
              {shitpostUpdatedLabel ? ` · updated ${shitpostUpdatedLabel}` : ""}
            </Text>
          </VStack>
        }
        endContent={
          <Button
            label="Refresh Reddit"
            variant="ghost"
            icon={<RefreshCw size={16} aria-hidden />}
            isIconOnly={!isDesktop}
            isLoading={shitpostLoading}
            isDisabled={shitpostLoading}
            onClick={refreshShitposts}
          />
        }
      />

      {shitpostError ? (
        <Banner
          status="error"
          container="section"
          title="Không load được Shitpost Feed"
          description={shitpostError}
        />
      ) : null}

      {shitpostWarning ? (
        <Banner
          status="warning"
          container="section"
          title="Reddit refresh bị throttle"
          description={shitpostWarning}
        />
      ) : null}

      <Section variant="muted" padding={4} dividers={["bottom"]}>
        <Text type="supporting" color="secondary">
          Newest media posts · Balanced round-robin · Public RSS with an hourly cache.
        </Text>
      </Section>

      <StackItem size="fill" isScrollable>
        <ShitpostFeedBoard
          items={shitpostItems}
          selectedId={selected && isShitpostItem(selected) ? selected.id : null}
          onSelect={selectItem}
          loading={shitpostLoading}
        />
      </StackItem>
    </VStack>
  );

  const feedWorkspace = isDesktop ? (
    <Layout
      height="fill"
      start={
        <LayoutPanel
          width={440}
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
      <Section variant="muted" padding={3} dividers={["bottom"]}>
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

  const shitpostWorkspace = isDesktop ? (
    <Layout
      height="fill"
      start={
        <LayoutPanel
          width={440}
          padding={0}
          hasDivider
          label="Shitpost Feed"
        >
          {shitpostContent}
        </LayoutPanel>
      }
    >
      <LayoutContent padding={0} label="Shitpost caption workspace">
        {composer}
      </LayoutContent>
    </Layout>
  ) : selected && isShitpostItem(selected) ? (
    <VStack gap={0}>
      <Section variant="muted" padding={3} dividers={["bottom"]}>
        <Button
          label="Back to Shitpost Feed"
          variant="ghost"
          icon={<ArrowLeft size={16} aria-hidden />}
          onClick={() => setSelected(null)}
        />
      </Section>
      {composer}
    </VStack>
  ) : (
    <VStack minHeight={640}>{shitpostContent}</VStack>
  );

  const workspaceContent =
    workspaceTab === "generated" ? (
      <GeneratedWorkWorkspace isDesktop={isDesktop} />
    ) : workspaceTab === "sos" ? (
      <SosCaptionWorkspace isDesktop={isDesktop} />
    ) : workspaceTab === "manual" ? (
      <ManualArticleWorkspace
        isDesktop={isDesktop}
        settings={prefs.settings}
        includeSourceUrl={prefs.includeSourceUrl}
        onIncludeSourceUrlChange={setIncludeSourceUrl}
      />
    ) : workspaceTab === "shitpost" ? (
      shitpostWorkspace
    ) : (
      feedWorkspace
    );

  const workspaceTabs = (
    <Section variant="section" padding={2} dividers={["bottom"]}>
      <TabList
        value={workspaceTab}
        onChange={(value) => {
          const next = value as WorkspaceTab;
          if (
            (next === "feed" && selected && isShitpostItem(selected)) ||
            (next === "shitpost" && selected && !isShitpostItem(selected))
          ) {
            setSelected(null);
          }
          if (next === "shitpost" && !shitpostLoaded) {
            setShitpostLoading(true);
          }
          setWorkspaceTab(next);
        }}
        layout={isDesktop ? "hug" : "fill"}
      >
        <Tab
          value="feed"
          label="News Feed"
          icon={<Newspaper size={16} aria-hidden />}
        />
        <Tab
          value="shitpost"
          label={isDesktop ? "Shitpost Feed" : "Memes"}
          icon={<Flame size={16} aria-hidden />}
        />
        <Tab
          value="sos"
          label={isDesktop ? "SOS Caption Generator" : "SOS"}
          icon={<Trophy size={16} aria-hidden />}
        />
        <Tab
          value="manual"
          label={isDesktop ? "Manual Article" : "Manual"}
          icon={<FileText size={16} aria-hidden />}
        />
        <Tab
          value="generated"
          label={isDesktop ? "Generated Work" : "Work"}
          icon={<Archive size={16} aria-hidden />}
        />
      </TabList>
    </Section>
  );

  return (
    <Theme theme={sumWorkspaceTheme} mode="dark">
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
                    src="/sum-editorial-logo.svg"
                    alt=""
                    width={142}
                    height={36}
                    loading="eager"
                  />
                }
                heading="Editorial"
                headingHref="/"
              />
            }
            endContent={
              <HStack gap={2} vAlign="center">
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
