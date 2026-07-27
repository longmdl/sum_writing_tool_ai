"use client";

import { DEFAULT_SETTINGS } from "./caption";
import type { PostSettings, SourceId } from "./types";

export interface Preferences {
  settings: PostSettings;
  sources: SourceId[];
  includeSourceUrl: boolean;
}

const STORAGE_KEY = "sum-pit-wall/v1";

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
  return { settings: DEFAULT_SETTINGS, sources, includeSourceUrl: false };
}

/** Referentially stable across calls — useSyncExternalStore requires it. */
export function getServerSnapshot(fallbackSources: SourceId[]): Preferences {
  serverSnapshot ??= defaults(fallbackSources);
  return serverSnapshot;
}

function read(fallbackSources: SourceId[]): Preferences {
  const base = defaults(fallbackSources);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Preferences>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
      sources:
        Array.isArray(saved.sources) && saved.sources.length > 0
          ? saved.sources
          : base.sources,
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
