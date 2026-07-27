"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Composer from "./Composer";
import FeedBoard from "./FeedBoard";
import SourcePicker from "./SourcePicker";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  updatePreferences,
  type Preferences,
} from "@/lib/preferences";
import type { NewsItem, PostSettings, Source, SourceId } from "@/lib/types";

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

/** Pure fetch — never touches state, so the effect below stays side-effect free. */
async function fetchFeed(sourceIds: SourceId[]): Promise<FeedResponse> {
  if (sourceIds.length === 0) {
    return { items: [], errors: [], fetchedAt: new Date().toISOString() };
  }
  const response = await fetch(
    `/api/feed?limit=10&sources=${sourceIds.join(",")}`,
    { cache: "no-store" },
  );
  const data = (await response.json()) as FeedResponse;
  if (!response.ok) throw new Error(data.error ?? "Không tải được tin.");
  return data;
}

export default function Workbench({ sources, defaultSourceIds }: WorkbenchProps) {
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

  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [caption, setCaption] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Joined rather than passed as an array so the effect compares by value.
  const sourcesKey = prefs.sources.join(",");

  useEffect(() => {
    let cancelled = false;
    const sourceIds = sourcesKey ? (sourcesKey.split(",") as SourceId[]) : [];

    void (async () => {
      try {
        const data = await fetchFeed(sourceIds);
        if (cancelled) return;
        setItems(data.items);
        setFeedErrors(data.errors ?? []);
        setFetchedAt(data.fetchedAt);
        setFeedError(null);
      } catch (error) {
        if (cancelled) return;
        setFeedError(error instanceof Error ? error.message : "Không tải được tin.");
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

  const selectItem = useCallback((item: NewsItem) => {
    setSelected(item);
    setCaption("");
    setModel(null);
    setGenerateError(null);
  }, []);

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
        model?: string;
        error?: string;
      };
      if (!response.ok || !data.caption) {
        throw new Error(data.error ?? "Soạn caption thất bại.");
      }
      setCaption(data.caption);
      setModel(data.model ?? null);
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Soạn caption thất bại.",
      );
    } finally {
      setGenerating(false);
    }
  }, [selected, prefs, extraInstructions]);

  const updatedLabel = useMemo(() => {
    if (!fetchedAt) return null;
    return new Date(fetchedAt).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [fetchedAt]);

  return (
    <main className="flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* Timing board — incoming data. */}
      <section
        aria-label="Bảng tin mới nhất"
        className="lg:w-[420px] xl:w-[460px] shrink-0 bg-asphalt border-b lg:border-b-0 lg:border-r border-guardrail/60 flex flex-col lg:h-screen"
      >
        <header className="px-3 pt-4 pb-3 border-b border-guardrail/40">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-display text-[15px] font-bold tracking-[0.14em] uppercase text-white">
              SUM<span className="text-flag"> / </span>Pit Wall
            </h1>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="font-mono text-[10px] uppercase tracking-wider text-dim hover:text-white disabled:opacity-50 transition-colors"
            >
              {loading ? "Đang tải…" : "Làm mới"}
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-dim">
            10 tin mới nhất
            {updatedLabel ? ` · cập nhật ${updatedLabel}` : ""}
          </p>
        </header>

        <SourcePicker
          sources={sources}
          enabled={prefs.sources}
          onToggle={toggleSource}
        />

        {feedError ? (
          <p role="alert" className="px-3 py-3 text-[13px] text-flag">
            {feedError}
          </p>
        ) : null}

        {feedErrors.length > 0 ? (
          <p className="px-3 py-2 text-[11px] text-yellow border-b border-guardrail/40">
            Không tải được: {feedErrors.map((e) => e.sourceName).join(", ")}
          </p>
        ) : null}

        <div className="board-scroll flex-1 lg:overflow-y-auto">
          <FeedBoard
            items={items}
            selectedId={selected?.id ?? null}
            onSelect={selectItem}
            loading={loading}
          />
        </div>
      </section>

      {/* Paper — outgoing copy. */}
      <section
        aria-label="Soạn caption"
        className="flex-1 bg-paper paper-grain lg:h-screen lg:overflow-y-auto"
      >
        <Composer
          item={selected}
          caption={caption}
          onCaptionChange={setCaption}
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
      </section>
    </main>
  );
}
