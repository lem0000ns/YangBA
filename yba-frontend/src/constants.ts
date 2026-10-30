/** Display metadata for a queryable stat column. */
export interface StatMeta {
  label: string;
  short: string;
  group: "Scoring" | "Shooting" | "All-around" | "Volume";
}

export const STAT_META: Record<string, StatMeta> = {
  points: { label: "Points", short: "PTS", group: "Scoring" },
  fgm: { label: "Field goals made", short: "FGM", group: "Scoring" },
  fga: { label: "Field goal attempts", short: "FGA", group: "Scoring" },
  "3pm": { label: "Threes made", short: "3PM", group: "Scoring" },
  "3pa": { label: "Three attempts", short: "3PA", group: "Scoring" },
  ftm: { label: "Free throws made", short: "FTM", group: "Scoring" },
  fta: { label: "Free throw attempts", short: "FTA", group: "Scoring" },
  fgpct: { label: "Field goal %", short: "FG%", group: "Shooting" },
  "3pct": { label: "Three-point %", short: "3P%", group: "Shooting" },
  ftpct: { label: "Free throw %", short: "FT%", group: "Shooting" },
  ast: { label: "Assists", short: "AST", group: "All-around" },
  reb: { label: "Rebounds", short: "REB", group: "All-around" },
  steals: { label: "Steals", short: "STL", group: "All-around" },
  blocks: { label: "Blocks", short: "BLK", group: "All-around" },
  turnovers: { label: "Turnovers", short: "TOV", group: "All-around" },
  fpts: { label: "Fantasy points", short: "FPTS", group: "All-around" },
  min: { label: "Minutes", short: "MIN", group: "Volume" },
  games: { label: "Games played", short: "GP", group: "Volume" },
  stage: { label: "Stage", short: "STG", group: "Volume" },
};

export const QUERY_STATS = [
  "points",
  "fgm",
  "fga",
  "ftm",
  "fta",
  "3pm",
  "3pa",
  "3pct",
  "fgpct",
  "ftpct",
  "ast",
  "reb",
  "steals",
  "blocks",
  "turnovers",
  "fpts",
  "min",
  "games",
];

const FILTER_BASE = QUERY_STATS.filter((s) => s != "games");
export const GAME_FILTER_STATS = [...FILTER_BASE];
export const RANK_FILTER_STATS = [...FILTER_BASE, "games"];

export const PCT_STATS = ["3pct", "fgpct", "ftpct"];

export const AGG_OPTIONS = [
  { value: "sum", label: "Total" },
  { value: "avg", label: "Per game" },
  { value: "max", label: "Best game" },
  { value: "min", label: "Worst game" },
];

/** UI ending years for loaded data (2015-16 through 2025-26). */
export const SEASONS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/** Season values are the year a season ends; the API is queried with value - 1. */
export const seasonLabel = (season: string) => {
  const end = Number(season);
  if (!end) return season;
  return `${end - 1}–\u2060${String(end).slice(2)}`;
};

export const STAGES = ["Preseason", "Regular Season", "Playoffs"];
export const DEFAULT_STAGE = "Regular Season";

export const STAGE_LABELS: Record<string, string> = {
  "1": "Pre",
  "2": "Reg",
  "3": "Playoffs",
  "4": "Playoffs",
  "5": "Playoffs",
};

export const TEAMS: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "LA Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

/** Long label for a stat key, or the key itself. */
export const statLabel = (stat: string) => STAT_META[stat]?.label ?? stat;
/** Abbreviation for tables and chips. */
export const statShort = (stat: string) =>
  STAT_META[stat]?.short ?? stat.toUpperCase();
/** Human label for an aggregation mode (sum, avg, …). */
export const aggLabel = (agg: string) =>
  AGG_OPTIONS.find((a) => a.value == agg)?.label ?? agg;

/** Natural-language phrase for a stat + aggregation pair. */
export const describeStat = (stat: string, agg: string) => {
  const label = statLabel(stat);
  if (stat == "games") return "Games played";
  if (PCT_STATS.includes(stat)) {
    if (agg == "max") return `Best single-game ${label}`;
    if (agg == "min") return `Worst single-game ${label}`;
    return label;
  }
  const lower = label.toLowerCase();
  if (agg == "avg") return `${label} per game`;
  if (agg == "sum") return `Total ${lower}`;
  if (agg == "max") return `Most ${lower} in a game`;
  if (agg == "min") return `Fewest ${lower} in a game`;
  return label;
};

/** Format a numeric API value for display (percentages, integers, decimals). */
export const formatStat = (value: number, stat: string, agg = "") => {
  if (value == null || Number.isNaN(value)) return "—";
  if (PCT_STATS.includes(stat)) return `${(value * 100).toFixed(1)}%`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return agg == "sum" ? value.toFixed(0) : value.toFixed(1);
};

/** ESPN default points-league FPTS from a game row (fallback if API omits FPTS). */
export const computeFPTS = (s: Record<string, string | number>) => {
  const n = (key: string) => Number(s[key]) || 0;
  return (
    2 * n("fgm") - n("fga") + n("3pm") + 2 * n("ast") + n("reb") +
    4 * (n("steals") + n("blocks")) - 2 * n("turnovers") + n("points") - (n("fta") - n("ftm"))
  );
};

/**
 * New on each dev page load. Localhost and yangba.net do not share an image
 * cache, so a stable URL was still showing the old RealGM portrait locally.
 */
const headshotDevBust = import.meta.env.DEV ? `?v=${Date.now()}` : "";

/** CloudFront URL for a player's headshot JPG. */
export const playerImageURL = (name: string) =>
  `https://d2qd9wn47agcqj.cloudfront.net/allPlayerImages/${name
    .replace(/[\s']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()}.jpg${headshotDevBust}`;

/** Split an API filter token like `points>30` into stat, operator, and value. */
export const parseFilter = (filter: string) => {
  const match = filter.match(/^([^<>=]+)([<>=])(.*)$/);
  if (!match) return { stat: filter, op: "", num: "" };
  return { stat: match[1], op: match[2], num: match[3] };
};

/** Turn a filter token into readable text; perGame applies to rank average filters. */
export const describeFilter = (filter: string, perGame = false) => {
  const { stat, op, num } = parseFilter(filter);
  if (!op) return filter;
  if (stat == "stage") {
    const value = Number(num);
    if (op == "=") return value == 1 ? "Preseason only" : value == 2 ? "Regular season only" : "Playoffs only";
    return `Stage ${op == ">" ? "after" : "before"} ${value == 1 ? "preseason" : value == 2 ? "regular season" : "playoffs"}`;
  }
  const label = statLabel(stat);
  if (PCT_STATS.includes(stat)) {
    const pct = `${+(Number(num) * 100).toFixed(1)}%`;
    return `${label} ${op == ">" ? "above" : op == "<" ? "below" : "of"} ${pct}`;
  }
  const word = op == ">" ? "More than" : op == "<" ? "Fewer than" : "Exactly";
  const suffix = perGame && stat != "games" ? " per game" : "";
  return `${word} ${num} ${label.toLowerCase()}${suffix}`;
};
