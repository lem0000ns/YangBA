import { seasonLabel, TEAMS } from "../constants.ts";
import type { TeamStint } from "./filter.tsx";

/** One regular-season game row from the games API. */
export interface CareerGame {
  stage?: string | number;
  team?: string;
  season?: string | number;
  points?: string | number;
  reb?: string | number;
  ast?: string | number;
  steals?: string | number;
  blocks?: string | number;
  fgm?: string | number;
  fga?: string | number;
  ftm?: string | number;
  fta?: string | number;
  "3pm"?: string | number;
  "3pa"?: string | number;
}

/** One team-specific season line. Averages are makes and minutes for that team only. */
export interface SeasonLine {
  seasonStart: number;
  season: string;
  gp: string;
  ppg: string;
  rpg: string;
  apg: string;
  spg: string;
  bpg: string;
  fg: string;
  tp: string;
  ft: string;
}

/** A team stop on the profile, with regular-season splits nested underneath. */
export interface CareerSection {
  id: string;
  name: string;
  years: string;
  affiliate: boolean;
  current: boolean;
  seasons: SeasonLine[];
}

interface Totals {
  gp: number;
  points: number;
  reb: number;
  ast: number;
  steals: number;
  blocks: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
}

interface IndexedStint {
  id: string;
  source: number;
  name: string;
  years: string;
  affiliate: boolean;
  current: boolean;
  code: string | null;
  start: number | null;
  end: number | null;
  single: boolean;
  present: boolean;
  buckets: Map<number, Totals>;
}

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Compare Wikipedia names with box-score abbreviations ("Los Angeles Clippers" and "LA Clippers"). */
const canonical = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^losangeles/, "la")
    .replace(/^newyork/, "ny")
    .replace(/sixers/g, "76ers");

const CODE_BY_NAME = new Map<string, string>();
for (const [code, label] of Object.entries(TEAMS)) {
  CODE_BY_NAME.set(canonical(label), code);
}
CODE_BY_NAME.set(canonical("Los Angeles Clippers"), "LAC");
CODE_BY_NAME.set(canonical("Philadelphia Sixers"), "PHI");

const teamCode = (name: string) => CODE_BY_NAME.get(canonical(name)) ?? null;

const gameCode = (team: string) => {
  const raw = team.trim();
  if (TEAMS[raw]) return raw;
  return teamCode(raw) ?? raw;
};

const emptyTotals = (): Totals => ({
  gp: 0,
  points: 0,
  reb: 0,
  ast: 0,
  steals: 0,
  blocks: 0,
  fgm: 0,
  fga: 0,
  tpm: 0,
  tpa: 0,
  ftm: 0,
  fta: 0,
});

const addGame = (totals: Totals, game: CareerGame) => {
  totals.gp += 1;
  totals.points += num(game.points);
  totals.reb += num(game.reb);
  totals.ast += num(game.ast);
  totals.steals += num(game.steals);
  totals.blocks += num(game.blocks);
  totals.fgm += num(game.fgm);
  totals.fga += num(game.fga);
  totals.tpm += num(game["3pm"]);
  totals.tpa += num(game["3pa"]);
  totals.ftm += num(game.ftm);
  totals.fta += num(game.fta);
};

const perGame = (total: number, games: number) => (total / games).toFixed(1);

const percent = (made: number, attempts: number) =>
  attempts > 0 ? `${((made / attempts) * 100).toFixed(1)}%` : "—";

const seasonLines = (buckets: Map<number, Totals>): SeasonLine[] =>
  [...buckets.entries()]
    .filter(([, totals]) => totals.gp > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([seasonStart, totals]) => ({
      seasonStart,
      season: seasonLabel(String(seasonStart + 1)),
      gp: String(totals.gp),
      ppg: perGame(totals.points, totals.gp),
      rpg: perGame(totals.reb, totals.gp),
      apg: perGame(totals.ast, totals.gp),
      spg: perGame(totals.steals, totals.gp),
      bpg: perGame(totals.blocks, totals.gp),
      fg: percent(totals.fgm, totals.fga),
      tp: percent(totals.tpm, totals.tpa),
      ft: percent(totals.ftm, totals.fta),
    }));

const parseYears = (year: string) => {
  const present = /present/i.test(year);
  const years = (year.match(/\d{4}/g) ?? []).map(Number);
  if (!years.length) return { start: null, end: null, single: false, present };
  if (present) return { start: years[0], end: null, single: false, present: true };
  if (years.length === 1) return { start: years[0], end: years[0], single: true, present: false };
  return { start: years[0], end: years[years.length - 1], single: false, present: false };
};

/** Season start S is inside the labeled years. End years are exclusive. */
const contains = (stint: IndexedStint, season: number) => {
  if (stint.start == null) return false;
  if (stint.single) return season === stint.start;
  if (stint.present || stint.end == null) return season >= stint.start;
  return season >= stint.start && season < stint.end;
};

/**
 * Joined during the season that ends in the labeled start year.
 * February 2025 trades are labeled "2025–…" while the season started in 2024.
 */
const joinedMidSeason = (stint: IndexedStint, season: number) =>
  stint.start != null && season === stint.start - 1;

/**
 * Left during a season that started in the labeled end year.
 * A November 2018 trade is often labeled "…–2018" for the 2018–19 season.
 */
const leftAtSeasonStart = (stint: IndexedStint, season: number) =>
  !stint.single && !stint.present && stint.end != null && season === stint.end;

const latest = (stints: IndexedStint[]) =>
  [...stints].sort((a, b) => (b.start ?? 0) - (a.start ?? 0) || b.source - a.source)[0];

/** Attach one team-season to the Wikipedia stop for that franchise, without merging other teams. */
const claim = (stints: IndexedStint[], code: string, season: number) => {
  const candidates = stints.filter((stint) => stint.code === code);
  const contained = candidates.filter((stint) => contains(stint, season));
  if (contained.length) return latest(contained);
  const departures = candidates.filter((stint) => leftAtSeasonStart(stint, season));
  if (departures.length) return latest(departures);
  const arrivals = candidates.filter((stint) => joinedMidSeason(stint, season));
  if (arrivals.length) return latest(arrivals);
  return null;
};

const yearValue = (section: CareerSection) => {
  const years = (section.years.match(/\d{4}/g) ?? []).map(Number);
  if (years.length) return Math.max(...years);
  if (section.seasons.length) return Math.max(...section.seasons.map((row) => row.seasonStart)) + 1;
  return 0;
};

const startValue = (section: CareerSection) => {
  const years = (section.years.match(/\d{4}/g) ?? []).map(Number);
  if (years.length) return years[0];
  if (section.seasons.length) return Math.min(...section.seasons.map((row) => row.seasonStart));
  return 0;
};

/**
 * Regular-season lines for each career stop.
 * The same season can appear under more than one team when a player was traded.
 * Stops with no box scores stay in the timeline and do not get an empty row.
 */
export const careerSections = (stints: TeamStint[], games: CareerGame[]): CareerSection[] => {
  const indexed: IndexedStint[] = stints.map((stint, index) => {
    const years = parseYears(stint.year);
    return {
      id: `stint-${index}`,
      source: index,
      name: stint.team,
      years: stint.year,
      affiliate: stint.affiliate,
      current: stint.current,
      code: stint.affiliate ? null : teamCode(stint.team),
      ...years,
      buckets: new Map<number, Totals>(),
    };
  });

  const groups = new Map<string, { code: string; season: number; totals: Totals }>();
  for (const game of games) {
    if (game.stage != null && String(game.stage) !== "2") continue;
    const code = gameCode(String(game.team ?? ""));
    const season = Number(game.season);
    if (!code || !Number.isFinite(season)) continue;
    const key = `${code}|${season}`;
    const group = groups.get(key) ?? { code, season, totals: emptyTotals() };
    addGame(group.totals, game);
    groups.set(key, group);
  }

  const orphans = new Map<string, Map<number, Totals>>();
  for (const group of groups.values()) {
    const owner = claim(indexed, group.code, group.season);
    const buckets = owner
      ? owner.buckets
      : orphans.get(group.code) ?? new Map<number, Totals>();
    if (!owner) orphans.set(group.code, buckets);
    const existing = buckets.get(group.season) ?? emptyTotals();
    existing.gp += group.totals.gp;
    existing.points += group.totals.points;
    existing.reb += group.totals.reb;
    existing.ast += group.totals.ast;
    existing.steals += group.totals.steals;
    existing.blocks += group.totals.blocks;
    existing.fgm += group.totals.fgm;
    existing.fga += group.totals.fga;
    existing.tpm += group.totals.tpm;
    existing.tpa += group.totals.tpa;
    existing.ftm += group.totals.ftm;
    existing.fta += group.totals.fta;
    buckets.set(group.season, existing);
  }

  const sections: CareerSection[] = indexed.map((stint) => ({
    id: stint.id,
    name: stint.name,
    years: stint.years,
    affiliate: stint.affiliate,
    current: stint.current,
    seasons: seasonLines(stint.buckets),
  }));

  for (const [code, buckets] of orphans) {
    const seasons = seasonLines(buckets);
    if (!seasons.length) continue;
    const oldest = Math.min(...seasons.map((row) => row.seasonStart));
    const newest = Math.max(...seasons.map((row) => row.seasonStart));
    sections.push({
      id: `games-${code}-${oldest}`,
      name: TEAMS[code] ?? code,
      years: seasons.length === 1 ? seasons[0].season : `${oldest}–${newest + 1}`,
      affiliate: false,
      current: false,
      seasons,
    });
  }

  return sections.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    const recent = yearValue(b) - yearValue(a);
    if (recent) return recent;
    return startValue(b) - startValue(a);
  });
};

/** The newest stop that actually has regular-season rows. */
export const defaultOpenSection = (sections: CareerSection[]) =>
  sections.find((section) => section.seasons.length > 0)?.id ?? null;
