import axios from "axios";
import { apiBaseUrl } from "../apiConfig.ts";
import { computeURL } from "../utilities.tsx";
import type { CareerGame } from "./careerSplits.ts";

/** Player bio plus the regular-season games used to build the career tables. */
export interface CachedProfile {
  player: Record<string, unknown>;
  games: CareerGame[];
}

const PREFIX = "yba-profile:";
const memory = new Map<string, CachedProfile>();
const inflightPlayers = new Map<string, Promise<Record<string, unknown> | null>>();
const inflightGames = new Map<string, Promise<CareerGame[]>>();

const cacheKey = (name: string) => name.trim().toLowerCase();

const KEEP = [
  "team",
  "season",
  "points",
  "reb",
  "ast",
  "steals",
  "blocks",
  "fgm",
  "fga",
  "ftm",
  "fta",
  "3pm",
  "3pa",
] as const;

/** Keep only the fields the career table aggregates, so a full game log fits in this tab. */
const slimGames = (games: unknown): CareerGame[] => {
  if (!Array.isArray(games)) return [];
  return games.map((game) => {
    const source = game as CareerGame;
    const row: Record<string, string | number> = { stage: "2" };
    for (const key of KEEP) {
      const value = source[key];
      if (typeof value == "string" || typeof value == "number") row[key] = value;
    }
    return row as CareerGame;
  });
};

const readStored = (key: string): CachedProfile | null => {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfile;
    if (!parsed || typeof parsed.player != "object" || parsed.player == null || !Array.isArray(parsed.games)) {
      return null;
    }
    return { player: parsed.player, games: parsed.games };
  } catch {
    return null;
  }
};

/** Profile saved earlier in this tab, from memory or from the reload-safe store. */
export const readProfileCache = (name: string): CachedProfile | null => {
  const key = cacheKey(name);
  const remembered = memory.get(key);
  if (remembered) return remembered;
  const stored = readStored(key);
  if (stored) memory.set(key, stored);
  return stored;
};

const writeProfileCache = (name: string, entry: CachedProfile) => {
  const key = cacheKey(name);
  memory.set(key, entry);
  const canonical = typeof entry.player.name == "string" ? cacheKey(entry.player.name) : "";
  if (canonical) memory.set(canonical, entry);
  try {
    const raw = JSON.stringify(entry);
    sessionStorage.setItem(PREFIX + key, raw);
    if (canonical && canonical != key) sessionStorage.setItem(PREFIX + canonical, raw);
  } catch {
    // Storage can be full or disabled. Back and forward in this visit still hit memory.
  }
};

/** One in-flight player request per name. A second mount waits on the same call. */
export const loadPlayer = (name: string) => {
  const saved = readProfileCache(name);
  if (saved) return Promise.resolve(saved.player);
  const key = cacheKey(name);
  let pending = inflightPlayers.get(key);
  if (!pending) {
    pending = axios
      .get(`${apiBaseUrl}players?name=${encodeURIComponent(name)}`)
      .then((response) => {
        const player = response.data.player;
        return player && typeof player == "object" ? (player as Record<string, unknown>) : null;
      })
      .finally(() => inflightPlayers.delete(key));
    inflightPlayers.set(key, pending);
  }
  return pending;
};

/** One in-flight regular-season request per name. */
export const loadCareerGames = (name: string) => {
  const saved = readProfileCache(name);
  if (saved) return Promise.resolve(saved.games);
  const key = cacheKey(name);
  let pending = inflightGames.get(key);
  if (!pending) {
    const url = `${apiBaseUrl}games?${computeURL(name, "", "", [], [], 100000, "", "", "Regular Season")}`;
    pending = axios
      .get(url)
      .then((response) => slimGames(response.data.games))
      .finally(() => inflightGames.delete(key));
    inflightGames.set(key, pending);
  }
  return pending;
};

/** Save both halves once they have succeeded, including after the page has moved on. */
export const rememberProfile = (name: string, player: Record<string, unknown> | null, games: CareerGame[]) => {
  if (!player) return;
  writeProfileCache(name, { player, games });
};
