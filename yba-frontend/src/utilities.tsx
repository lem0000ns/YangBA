import {
  PCT_STATS,
  TEAMS,
  describeFilter,
  seasonLabel,
  statLabel,
} from "./constants";

/** Values needed to reopen a stats, games, or rankings form. */
export interface QueryDraft {
  name?: string;
  stat?: string;
  agg?: string;
  seasons?: string[];
  filters?: string[];
  limit?: number;
  order?: string;
  team?: string;
  stage?: string;
}

/** Saved stats, games, or rank response for one results URL. */
export interface CachedResult {
  result: unknown;
  statInfo: string;
  percentile: number | null;
  resolvedName: string;
  /** Box scores behind a stats result. Null when the query has no player. Missing on older cache entries. */
  games?: Array<Record<string, string | number>> | null;
}

const RESULT_CACHE_PREFIX = "yba-result:";

const omitPlaceholder = (value: string | undefined) => {
  if (!value) return "";
  if (value == "Select team (optional)" || value == "Select a stage (optional)") return "";
  return value;
};

/** Builds a results URL whose query string contains only the fields that are set. */
export function resultsPath(kind: string, query: QueryDraft) {
  const params = new URLSearchParams();
  const name = omitPlaceholder(query.name);
  const stat = omitPlaceholder(query.stat);
  const agg = stat == "games" ? "sum" : omitPlaceholder(query.agg);
  const order = omitPlaceholder(query.order);
  const team = omitPlaceholder(query.team);
  const stage = omitPlaceholder(query.stage);
  if (name) params.set("name", name);
  if (query.seasons?.length) params.set("seasons", query.seasons.join(","));
  if (query.filters?.length) params.set("filters", query.filters.join(","));
  if (query.limit != null && query.limit != -1 && !Number.isNaN(query.limit)) {
    params.set("limit", String(query.limit));
  }
  if (stat) params.set("stat", stat);
  if (agg) params.set("agg", agg);
  if (order) params.set("order", order);
  if (team) params.set("team", team);
  if (stage) params.set("stage", stage);
  const search = params.toString();
  return `/${kind}/results${search ? `?${search}` : ""}`;
}

/** Reads a results query back out of a URL search string. */
export function queryFromSearch(params: URLSearchParams): QueryDraft {
  const list = (key: string) => {
    const value = params.get(key);
    return value ? value.split(",").filter(Boolean) : [];
  };
  const limitRaw = params.get("limit");
  const limit = limitRaw == null || limitRaw == "" ? -1 : Number(limitRaw);
  return {
    name: params.get("name") ?? "",
    stat: params.get("stat") ?? "",
    agg: params.get("agg") ?? "",
    seasons: list("seasons"),
    filters: list("filters"),
    limit: Number.isNaN(limit) ? -1 : limit,
    order: params.get("order") ?? "",
    team: params.get("team") ?? "",
    stage: params.get("stage") ?? "",
  };
}

/** Returns a cached results payload for this results URL, if one was stored in this tab. */
export function readResultCache(key: string): CachedResult | null {
  try {
    const raw = sessionStorage.getItem(RESULT_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedResult;
    if (parsed == null || typeof parsed != "object" || !("result" in parsed) || typeof parsed.statInfo != "string") {
      return null;
    }
    return {
      result: parsed.result,
      statInfo: parsed.statInfo,
      percentile: typeof parsed.percentile == "number" ? parsed.percentile : null,
      resolvedName: parsed.resolvedName ?? "",
      games: Object.prototype.hasOwnProperty.call(parsed, "games")
        ? Array.isArray(parsed.games)
          ? parsed.games
          : null
        : undefined,
    };
  } catch {
    return null;
  }
}

/** Stores a results payload in this tab so a later visit can skip the API. */
export function writeResultCache(key: string, value: CachedResult) {
  try {
    sessionStorage.setItem(RESULT_CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage can be full or disabled. The page still shows the response it just loaded.
  }
}

/** Build query string parameters for the Lambda API from form state. */
function computeURL(
  name: string,
  stat: string,
  agg: string,
  seasons: string[],
  filters: string[],
  limit: Number,
  order: string,
  team: string,
  stage: string
) {
  let url = "";
  let isLimit = false;
  if (limit != -1) {
    url += "limit=" + limit;
    isLimit = true;
  }
  if (stat != "") isLimit ? (url += "&stat=" + stat) : (url += "stat=" + stat);
  if (name != "") url += "&name=" + encodeURIComponent(name);
  if (agg != "") {
    if (stat == "games") agg = "sum";
    url += "&agg=" + agg;
  }
  if (seasons.length > 0 && seasons[0] != "") {
    for (const szn of seasons) {
      let temp = Number(szn) - 1;
      url += "&season=" + temp;
    }
  }
  if (filters.length > 0) {
    let tempFilters = filters.join(",");
    url += "&filter=" + tempFilters;
  }
  if (order != "") {
    order == "Most" ? (url += "&order=desc") : (url += "&order=asc");
  }
  if (team != "" && team != "Select team (optional)") url += "&team=" + team;
  if (stage != "" && stage != "Select a stage (optional)") {
    if (stage == "Preseason") url += "&stage=1";
    else if (stage == "Regular Season") url += "&stage=2";
    else url += "&stage=3&stage=4&stage=5";
  }
  return url;
}

/** Human-readable summary of the current query (shown on results). */
function getStatInfo(
  name: string,
  stat: string,
  agg: string,
  seasons: string[],
  filters: string[],
  team: string,
  limit: Number,
  order: string,
  stage: string
) {
  const parts: string[] = [];
  if (name != "") parts.push(`${name}'s`);

  //rank
  if (order != "") {
    parts.push(`${order == "Most" ? "Top" : "Bottom"} ${limit} players by`);
  }
  //games
  else if (stat == "") {
    const count = Number(limit);
    parts.push(count > 0 ? `${count} ${count == 1 ? "game" : "games"}` : "games");
  }
  //rank or stats
  if (stat != "") {
    const label = statLabel(stat).toLowerCase();
    if (stat == "games") parts.push("games played");
    else if (PCT_STATS.includes(stat) && agg != "max" && agg != "min")
      parts.push(label);
    else if (agg == "sum") parts.push(`total ${label}`);
    else if (agg == "avg") parts.push(`${label} per game`);
    else if (agg == "max") parts.push(`most ${label} in a game`);
    else parts.push(`fewest ${label} in a game`);
  }

  if (team != "" && team != "Select team (optional)") {
    parts.push(`on the ${TEAMS[team] ?? team}`);
  }

  if (seasons.length == 1 && seasons[0] != "") {
    parts.push(`in ${seasonLabel(seasons[0])}`);
  } else if (seasons.length > 1) {
    parts.push(`across ${seasons.length} seasons`);
  }

  if (filters.length > 0) {
    const described = filters.map((f) => {
      const text = describeFilter(f, order != "");
      return text.charAt(0).toLowerCase() + text.slice(1);
    });
    parts.push(`with ${described.join(", ")}`);
  }

  if (stage != "" && stage != "Select a stage (optional)") {
    parts.push(`during the ${stage.toLowerCase()}`);
  }

  return parts.join(" ");
}

export { computeURL, getStatInfo };
