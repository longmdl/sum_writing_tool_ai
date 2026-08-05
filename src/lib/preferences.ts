"use client";

import { DEFAULT_SETTINGS } from "./caption";
import type { PostSettings, SourceId } from "./types";

export interface Preferences {
  settings: PostSettings;
  sources: SourceId[];
  includeSourceUrl: boolean;
}

const STORAGE_KEY = "sum-editorial/v5";
const PREVIOUS_STORAGE_KEY = "sum-editorial/v4";
const OLDER_STORAGE_KEY = "sum-editorial/v3";
const LEGACY_STORAGE_KEY = "sum-editorial/v2";
const EARLIEST_STORAGE_KEY = "sum-pit-wall/v1";
const NEW_DEFAULT_SOURCES: SourceId[] = ["traxion", "racefans"];
const NEW_MOTORSPORT_SOURCES: SourceId[] = [
  "motogp",
  "wec",
  "gt",
  "imsa",
  "gtwc",
];
const NEW_EXPANDED_SOURCES: SourceId[] = [
  "crash",
  "sportscar365",
  "dirtfish",
  "racer",
  "motorsportweek",
  "therace",
  "fia",
];

/**
 * localStorage-backed store read through useSyncExternalStore.
 *
 * A plain useEffect would work, but it renders defaults first and the saved
 * values a tick later — the admin sees their sources flip on load. The server
 * snapshot keeps SSR and the first client render in agreement instead.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

let serverSnapshot: Preferences | null = null;
let cache: Preferences | null = null;

function defaults(sources: SourceId[]): Preferences {
  return {
    settings: DEFAULT_SETTINGS,
    sources,
    includeSourceUrl: false,
  };
}

/** Referentially stable across calls — useSyncExternalStore requires it. */
export function getServerSnapshot(fallbackSources: SourceId[]): Preferences {
  serverSnapshot ??= defaults(fallbackSources);
  return serverSnapshot;
}

function read(fallbackSources: SourceId[]): Preferences {
  const base = defaults(fallbackSources);
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    const previous = current
      ? null
      : window.localStorage.getItem(PREVIOUS_STORAGE_KEY);
    const older =
      current || previous
        ? null
        : window.localStorage.getItem(OLDER_STORAGE_KEY);
    const legacy =
      current || previous || older
        ? null
        : window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const earliest =
      current || previous || older || legacy
        ? null
        : window.localStorage.getItem(EARLIEST_STORAGE_KEY);
    const raw = current ?? previous ?? older ?? legacy ?? earliest;
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Preferences>;
    const savedSettings = { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) };
    if (!current && savedSettings.author.trim() === "Sennar") {
      savedSettings.author = "";
    }
    const savedSources =
      Array.isArray(saved.sources) && saved.sources.length > 0
        ? saved.sources
        : base.sources;
    const migrationSources = earliest
      ? [
          ...NEW_DEFAULT_SOURCES,
          ...NEW_MOTORSPORT_SOURCES,
          ...NEW_EXPANDED_SOURCES,
        ]
      : previous
        ? NEW_EXPANDED_SOURCES
        : [...NEW_MOTORSPORT_SOURCES, ...NEW_EXPANDED_SOURCES];
    const sources = current
      ? savedSources
      : [...new Set([...savedSources, ...migrationSources])];

    return {
      settings: savedSettings,
      sources,
      includeSourceUrl: saved.includeSourceUrl === true,
    };
  } catch {
    // Corrupt or blocked storage just means defaults.
    return base;
  }
}

export function getSnapshot(fallbackSources: SourceId[]): Preferences {
  cache ??= read(fallbackSources);
  return cache;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Keep two open tabs in agreement.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updatePreferences(next: Preferences): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — preferences just will not survive a reload.
  }
  listeners.forEach((listener) => listener());
}
