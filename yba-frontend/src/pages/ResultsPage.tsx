import { Link, useSearchParams } from "react-router-dom";
import {
  CachedResult,
  computeURL,
  getStatInfo,
  queryFromSearch,
  readResultCache,
  resultsPath,
  writeResultCache,
} from "../utilities.tsx";
import {
  ArrowLeft,
  ArrowRight,
  Button,
  EmptyState,
  FilterPill,
  GoatMark,
  Loader,
  PercentileBar,
  PlayerAvatar,
  PlayerCard,
  ResultCard,
  SectionHeader,
  Sparkline,
  StatCard,
  SwapIcon,
  Table,
  TrendDown,
  TrendUp,
} from "../components/All.tsx";
import type { Column } from "../components/Table.tsx";
import { ReactNode, useState, useEffect, useRef, type RefObject } from "react";
import axios from "axios";
import {
  PCT_STATS,
  STAGE_LABELS,
  TEAMS,
  computeFPTS,
  describeStat,
  formatStat,
  seasonLabel,
  statShort,
} from "../constants.ts";
import { describeSeasons } from "./queryFields.tsx";
import { apiBaseUrl } from "../apiConfig.ts";

interface Props {
  path: string;
}

interface GameRow {
  name: string;
  playerID: number;
  gameID: number;
  stage: number;
  gameDate: string;
  team: string;
  season: number;
  points: number;
  FPTS: number;
  [stat: string]: string | number;
}

interface RankRow {
  rank: number;
  name: string;
  value: number;
}

const baseURL = apiBaseUrl;
const GAMES_PAGE_SIZE = 25;
/** Blank count. The live games route still requires a limit, and 0 means return nothing. */
const ALL_GAMES_LIMIT = 100000;

const fields = [
  "name",
  "stage",
  "gameDate",
  "team",
  "season",
  "points",
  "min",
  "fgm",
  "fga",
  "3pm",
  "3pa",
  "ftm",
  "fta",
  "reb",
  "ast",
  "steals",
  "blocks",
  "turnovers",
  "FPTS",
];

/** Parses MM-DD-YYYY strings into a short US locale date. */
const formatDate = (date: string) => {
  const [month, day, year] = date.split("-").map(Number);
  if (!year) return date;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Capitalizes the first character of a string. */
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Returns the arithmetic mean of numeric values, or zero when empty. */
const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/** Builds table column definitions for the game log results view. */
const gameColumns = (maxFpts: number): Column<GameRow>[] => fields.map((field) => {
  switch (field) {
    case "name":
      return {
        key: field,
        label: "Player",
        align: "left",
        render: (row) => (
          <Link className="table-player" to={`/players/${encodeURIComponent(row.name)}`}>
            {row.name}
          </Link>
        ),
      };
    case "stage":
      return {
        key: field,
        label: "Stage",
        align: "left",
        render: (row) => (
          <span className={`stage-tag stage-${row.stage}`}>{STAGE_LABELS[String(row.stage)] ?? row.stage}</span>
        ),
      };
    case "gameDate":
      return { key: field, label: "Date", align: "left", render: (row) => formatDate(row.gameDate) };
    case "team":
      return { key: field, label: "Team", align: "left" };
    case "season":
      return { key: field, label: "Season", align: "left", render: (row) => seasonLabel(String(row.season + 1)) };
    case "points":
      return { key: field, label: "PTS", emphasis: true };
    case "FPTS":
      return {
        key: field,
        label: "FPTS",
        render: (row) => (
          <span className="fpts-cell">
            <span className="fpts-cell-bar">
              <i style={{ width: `${Math.max(0, Math.min(1, row.FPTS / maxFpts)) * 100}%` }} />
            </span>
            <span className="tabular">{row.FPTS}</span>
          </span>
        ),
      };
    default:
      return { key: field, label: statShort(field) };
  }
});

const COUNTING_STATS = [
  "min",
  "points",
  "fgm",
  "fga",
  "3pm",
  "3pa",
  "ftm",
  "fta",
  "reb",
  "ast",
  "steals",
  "blocks",
  "turnovers",
  "fpts",
];

const SUMMARY_FIELDS = [
  "games",
  "min",
  "points",
  "fgm",
  "fga",
  "fgpct",
  "3pm",
  "3pa",
  "3pct",
  "ftm",
  "fta",
  "ftpct",
  "reb",
  "ast",
  "steals",
  "blocks",
  "turnovers",
  "fpts",
];

const RATE_ATTEMPTS: Record<string, [string, string]> = {
  fgpct: ["fgm", "fga"],
  "3pct": ["3pm", "3pa"],
  ftpct: ["ftm", "fta"],
};

const BOX_FIELDS = [
  "gameDate",
  "stage",
  "team",
  "season",
  "min",
  "points",
  "fgm",
  "fga",
  "fgpct",
  "3pm",
  "3pa",
  "3pct",
  "ftm",
  "fta",
  "ftpct",
  "reb",
  "ast",
  "steals",
  "blocks",
  "turnovers",
  "FPTS",
];

/** Makes divided by attempts for one game, or null when there were no attempts. */
const shootingRate = (row: GameRow, stat: string) => {
  const pair = RATE_ATTEMPTS[stat];
  if (!pair) return null;
  const attempts = Number(row[pair[1]]) || 0;
  if (!attempts) return null;
  return (Number(row[pair[0]]) || 0) / attempts;
};

/** The queried stat on one box score. Percentages with no attempts are skipped. */
const gameStatValue = (row: GameRow, stat: string) => {
  if (stat in RATE_ATTEMPTS) return shootingRate(row, stat);
  const field = stat == "fpts" ? "FPTS" : stat;
  const value = Number(row[field]);
  return Number.isFinite(value) ? value : null;
};

/** Games tied for the highest or lowest value of one stat. */
const extremeGames = (rows: GameRow[], stat: string, agg: "max" | "min") => {
  const scored = rows.flatMap((row) => {
    const value = gameStatValue(row, stat);
    return value == null ? [] : [{ row, value }];
  });
  if (!scored.length) return [];
  const target = scored.reduce(
    (best, item) => (agg == "max" ? Math.max(best, item.value) : Math.min(best, item.value)),
    scored[0].value
  );
  return scored.filter((item) => Math.abs(item.value - target) < 1e-6).map((item) => item.row);
};

/** One season line: totals or per-game averages, with shooting percentages from the combined makes and attempts. */
const summarizeGames = (rows: GameRow[], agg: "avg" | "sum") => {
  const totals: Record<string, number> = {};
  for (const key of COUNTING_STATS) {
    const field = key == "fpts" ? "FPTS" : key;
    totals[key] = rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
  }
  const line: Record<string, number | null> = {
    games: rows.length,
  };
  for (const key of COUNTING_STATS) {
    line[key] = agg == "avg" && rows.length ? totals[key] / rows.length : totals[key];
  }
  for (const [stat, [made, attempts]] of Object.entries(RATE_ATTEMPTS)) {
    line[stat] = totals[attempts] ? totals[made] / totals[attempts] : null;
  }
  return line;
};

/** Formats one cell of the average or total line. */
const formatLineStat = (value: number | null, stat: string, agg: string) => {
  if (value == null || Number.isNaN(value)) return "—";
  if (stat == "games") return value.toLocaleString();
  if (PCT_STATS.includes(stat)) return formatStat(value, stat);
  return formatStat(value, stat, agg);
};

/** Box-score columns for the games tied for a best or worst stat. */
const boxScoreColumns = (highlight: string): Column<GameRow>[] => {
  const marked = highlight == "fpts" ? "FPTS" : highlight;
  return BOX_FIELDS.map((field) => {
    const emphasis = field == marked;
    if (field == "stage") {
      return {
        key: field,
        label: "Stage",
        align: "left" as const,
        render: (row: GameRow) => (
          <span className={`stage-tag stage-${row.stage}`}>{STAGE_LABELS[String(row.stage)] ?? row.stage}</span>
        ),
      };
    }
    if (field == "gameDate") {
      return { key: field, label: "Date", align: "left" as const, render: (row: GameRow) => formatDate(row.gameDate) };
    }
    if (field == "team") return { key: field, label: "Team", align: "left" as const };
    if (field == "season") {
      return {
        key: field,
        label: "Season",
        align: "left" as const,
        render: (row: GameRow) => seasonLabel(String(Number(row.season) + 1)),
      };
    }
    if (field in RATE_ATTEMPTS) {
      return {
        key: field,
        label: statShort(field),
        emphasis,
        render: (row: GameRow) => {
          const value = shootingRate(row, field);
          return value == null ? "—" : formatStat(value, field);
        },
      };
    }
    return { key: field, label: statShort(field == "FPTS" ? "fpts" : field), emphasis };
  });
};

/** One row of every box-score stat, with the queried column marked. */
const summaryColumns = (highlight: string, agg: string): Column<Record<string, number | null>>[] =>
  SUMMARY_FIELDS.map((field) => ({
    key: field,
    label: field == "games" ? "GP" : statShort(field),
    align: field == "games" ? ("left" as const) : ("right" as const),
    emphasis: field == highlight,
    render: (row: Record<string, number | null>) => formatLineStat(row[field], field, agg),
  }));

/** Drops a cached stats payload that was saved before the box-score table existed. */
const usableCache = (payload: CachedResult | null, path: string, player: string) => {
  if (!payload) return null;
  if (path == "games" && Array.isArray(payload.result) && payload.result.length == 0) return null;
  if (path == "stats" && player != "" && payload.games === undefined) return null;
  return payload;
};

/** Box scores tied for a best or worst stat, paged like the game log. */
const ExtremeGames = ({
  title,
  rows,
  highlight,
  page,
  onPage,
  tableRef,
}: {
  title: string;
  rows: GameRow[];
  highlight: string;
  page: number;
  onPage: (page: number) => void;
  tableRef: RefObject<HTMLDivElement>;
}) => {
  if (!rows.length) return null;
  const pageCount = Math.max(1, Math.ceil(rows.length / GAMES_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const start = current * GAMES_PAGE_SIZE;
  const pageRows = rows.slice(start, start + GAMES_PAGE_SIZE);
  /** Shows another page of tied games and brings that table back into view. */
  const showPage = (next: number) => {
    onPage(next);
    tableRef.current?.scrollIntoView({ block: "start" });
  };
  return (
    <ResultCard
      flush
      className="stats-lines"
      title={title}
      eyebrow={
        pageCount > 1
          ? `${start + 1}–${start + pageRows.length} of ${rows.length}`
          : `${rows.length} ${rows.length == 1 ? "game" : "games"}`
      }
    >
      <div className="game-log" ref={tableRef}>
        <Table
          columns={boxScoreColumns(highlight)}
          rows={pageRows}
          rowKey={(row, i) => `${row.gameID}-${row.playerID}-${i}`}
        />
        {pageCount > 1 && (
          <nav className="table-pager" aria-label="Box score pages">
            <button type="button" aria-label="Previous page" disabled={current == 0} onClick={() => showPage(current - 1)}>
              <ArrowLeft size={16} />
            </button>
            <span className="table-pager-label tabular">
              {current + 1} / {pageCount}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={current == pageCount - 1}
              onClick={() => showPage(current + 1)}
            >
              <ArrowRight size={16} />
            </button>
          </nav>
        )}
      </div>
    </ResultCard>
  );
};

/** Shares one request when the page effect runs twice before the response arrives. */
const inflightResults = new Map<string, Promise<CachedResult>>();

/** Copies a cached or freshly loaded payload into the page state. */
const applyPayload = (
  payload: CachedResult,
  setResult: (value: any) => void,
  setStatInfo: (value: string) => void,
  setPercentile: (value: number | null) => void,
  setResolvedName: (value: string) => void,
  setBoxScores: (value: GameRow[] | null) => void
) => {
  setResult(payload.result);
  setStatInfo(payload.statInfo);
  setPercentile(payload.percentile);
  setResolvedName(payload.resolvedName);
  setBoxScores(Array.isArray(payload.games) ? (payload.games as GameRow[]) : null);
};

/** Loads and renders stats, games, or rank results from the URL query string. */
const ResultsPage = ({ path }: Props) => {
  const [searchParams] = useSearchParams();
  const draft = queryFromSearch(searchParams);
  const name = draft.name ?? "";
  const stat = draft.stat ?? "";
  const order = draft.order ?? "";
  const team = draft.team ?? "";
  const stage = draft.stage ?? "";
  const limit = draft.limit ?? -1;
  const agg = stat == "games" ? "sum" : draft.agg ?? "";
  const seasonsList = draft.seasons ?? [];
  const filtersList = draft.filters ?? [];
  const cacheKey = resultsPath(path, { ...draft, agg, seasons: seasonsList, filters: filtersList });
  const stored = readResultCache(cacheKey);
  const cached = usableCache(stored, path, name);
  const [result, setResult] = useState<any>(cached?.result);
  const [statInfo, setStatInfo] = useState(cached?.statInfo ?? "");
  const [percentile, setPercentile] = useState<number | null>(cached?.percentile ?? null);
  const [resolvedName, setResolvedName] = useState(cached?.resolvedName ?? "");
  const [boxScores, setBoxScores] = useState<GameRow[] | null>(
    Array.isArray(cached?.games) ? (cached.games as GameRow[]) : null
  );
  const [error, setError] = useState("");
  const [gamePage, setGamePage] = useState(0);
  const gameTable = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGamePage(0);
  }, [cacheKey]);

  useEffect(() => {
    const storedNow = readResultCache(cacheKey);
    const saved = usableCache(storedNow, path, name);
    if (saved) {
      applyPayload(saved, setResult, setStatInfo, setPercentile, setResolvedName, setBoxScores);
      setError("");
      return;
    }

    let cancelled = false;
    const requestUrl =
      baseURL +
      `${path}?` +
      computeURL(
        name,
        stat,
        agg,
        seasonsList,
        filtersList,
        path == "games" && limit == -1 ? ALL_GAMES_LIMIT : limit,
        order,
        team,
        stage
      );

    setResult(undefined);
    setStatInfo("");
    setPercentile(null);
    setResolvedName("");
    setBoxScores(null);
    setError("");

    let pending = inflightResults.get(cacheKey);
    if (!pending) {
      const withFantasy = (row: GameRow): GameRow => ({
        ...row,
        FPTS: row.FPTS != null ? Number(row.FPTS) : computeFPTS(row),
      });
      pending = (
        path == "stats"
          ? Promise.all([
              axios.get(requestUrl),
              name
                ? axios
                    .get(
                      baseURL +
                        "games?" +
                        computeURL(name, "", "", seasonsList, filtersList, ALL_GAMES_LIMIT, "", "", stage)
                    )
                    .then((gamesResponse) => (gamesResponse.data.games ?? []).map(withFantasy))
                    .catch((gamesError) => {
                      console.error(gamesError);
                      return [] as GameRow[];
                    })
                : Promise.resolve(null),
            ]).then(([response, games]) => {
              const value = response.data[agg + "_" + stat];
              if (typeof value != "number") throw new Error("missing stat in response");
              return {
                result: value,
                statInfo: getStatInfo(name, stat, agg, seasonsList, filtersList, "", -1, "", stage),
                percentile: response.data.percentile ? response.data.percentile : null,
                resolvedName: response.data.name ?? name,
                games,
              };
            })
          : axios.get(requestUrl).then((response) => {
              if (path == "games") {
                return {
                  result: (response.data.games ?? []).map(withFantasy),
                  statInfo: getStatInfo(name, "", "", seasonsList, filtersList, "", limit, "", stage),
                  percentile: null,
                  resolvedName: "",
                };
              }
              return {
                result: response.data.result.map((item: any, index: number) => ({
                  rank: index + 1,
                  name: item.name,
                  value: item[agg + "_" + stat],
                })),
                statInfo: getStatInfo("", stat, agg, seasonsList, filtersList, team, limit, order, stage),
                percentile: null,
                resolvedName: "",
              };
            })
      );
      inflightResults.set(cacheKey, pending);
      pending.finally(() => inflightResults.delete(cacheKey));
    }

    pending
      .then((payload) => {
        if (cancelled) return;
        applyPayload(payload, setResult, setStatInfo, setPercentile, setResolvedName, setBoxScores);
        writeResultCache(cacheKey, payload);
      })
      .catch((requestError) => {
        console.error("there was an error: " + requestError);
        if (!cancelled) setError("There was an error");
      });

    return () => {
      cancelled = true;
    };
    // The cache key is the canonical results URL, so it changes exactly when the query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const formPath = `/${path}`;
  const eyebrow = path == "stats" ? "Stats result" : path == "games" ? "Game log" : "Leaderboard";

  const contextChips = (
    <div className="context-chips">
      {seasonsList.length > 0 && <span className="chip is-static">{describeSeasons(seasonsList)}</span>}
      {team && <span className="chip is-static">{TEAMS[team] ?? team}</span>}
      {stage && <span className="chip is-static">{stage}</span>}
      {filtersList.map((filter, index) => (
        <FilterPill key={`${filter}-${index}`} filter={filter} perGame={path == "rank"} />
      ))}
    </div>
  );

  /** Renders back link, title, and filter chips for results pages. */
  const header = (actions?: ReactNode) => (
    <>
      <Link to={formPath} className="back-link">
        <ArrowLeft size={14} /> New {path == "rank" ? "ranking" : path == "games" ? "game search" : "query"}
      </Link>
      <SectionHeader size="page" eyebrow={eyebrow} title={capitalize(statInfo)} actions={actions} />
      {contextChips}
    </>
  );

  if (error) {
    return (
      <div className="page page-results">
        <EmptyState
          tone="error"
          title="Something went wrong"
          message="We couldn't load these results. Try again or change the query."
          action={<Button to={formPath} state={{ draft }} arrow>Back</Button>}
        />
      </div>
    );
  }

  if (result === undefined || !statInfo) {
    return (
      <div className="page page-results">
        <Loader />
      </div>
    );
  }

  if (path == "games") {
    const games = result as GameRow[];
    if (games.length == 0) {
      return (
        <div className="page page-results">
          {header()}
          <EmptyState
            title="No games found"
            message="Try fewer filters or more seasons."
            action={<Button to={formPath} state={{ draft }} arrow>Edit search</Button>}
          />
        </div>
      );
    }
    const points = games.map((g) => Number(g.points) || 0);
    const best = games[points.indexOf(Math.max(...points))];
    const fpts = games.map((g) => g.FPTS);
    const pageCount = Math.max(1, Math.ceil(games.length / GAMES_PAGE_SIZE));
    const page = Math.min(gamePage, pageCount - 1);
    const start = page * GAMES_PAGE_SIZE;
    const pageRows = games.slice(start, start + GAMES_PAGE_SIZE);
    const rangeEnd = start + pageRows.length;
    /** Shows another page of stat lines and brings that table back into view. */
    const showGamePage = (next: number) => {
      setGamePage(next);
      gameTable.current?.scrollIntoView({ block: "start" });
    };
    const playerName = name ? games.find((game) => game.name)?.name || name : "";
    return (
      <div className="page page-results">
        {header(
          <Button to={formPath} state={{ draft }} variant="secondary" size="sm">
            Edit search
          </Button>
        )}
        {playerName && (
          <div className="games-player">
            <PlayerCard name={playerName} meta={seasonsList.length ? describeSeasons(seasonsList) : "All seasons"}>
              <p className="player-card-note">Game log</p>
            </PlayerCard>
          </div>
        )}
        <div className="stat-row">
          <StatCard label="Games" value={games.length} />
          <StatCard label="Points per game" value={average(points)} format={(v) => v.toFixed(1)} delay={60}>
            <Sparkline values={points} />
          </StatCard>
          <StatCard
            label="Best scoring game"
            value={best.points}
            unit="PTS"
            sub={`${best.name} · ${formatDate(best.gameDate)}`}
            delay={120}
          />
          <StatCard
            label="Average FPTS"
            value={average(fpts)}
            format={(v) => v.toFixed(1)}
            delay={180}
          />
        </div>
        <ResultCard
          flush
          title="Stat lines"
          eyebrow={
            pageCount > 1
              ? `${start + 1}–${rangeEnd} of ${games.length}`
              : `${games.length} ${games.length == 1 ? "game" : "games"}`
          }
        >
          <div className="game-log" ref={gameTable}>
            <Table
              columns={gameColumns(Math.max(...fpts, 1))}
              rows={pageRows}
              rowKey={(row, i) => `${row.gameID}-${row.playerID}-${i}`}
            />
            {pageCount > 1 && (
              <nav className="table-pager" aria-label="Stat line pages">
                <button type="button" aria-label="Previous page" disabled={page == 0} onClick={() => showGamePage(page - 1)}>
                  <ArrowLeft size={16} />
                </button>
                <span className="table-pager-label tabular">
                  {page + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page == pageCount - 1}
                  onClick={() => showGamePage(page + 1)}
                >
                  <ArrowRight size={16} />
                </button>
              </nav>
            )}
          </div>
        </ResultCard>
      </div>
    );
  }

  if (path === "stats") {
    const value = result as number;
    const displayName = resolvedName || name;
    const pctValue = percentile != null ? percentile * 100 : null;
    const gameLog = resultsPath("games", {
      name: displayName,
      seasons: seasonsList,
      filters: filtersList,
      limit: 25,
    });
    const matched =
      boxScores && (agg == "max" || agg == "min") ? extremeGames(boxScores, stat, agg) : [];
    const matchedTitle =
      matched.length == 1
        ? agg == "max"
          ? "Best game"
          : "Worst game"
        : agg == "max"
          ? "Best games"
          : "Worst games";

    return (
      <div className="page page-results">
        {header()}
        <div className={`stats-result ${displayName ? "" : "is-league"}`}>
          {displayName ? (
            <PlayerCard name={displayName} meta={seasonsList.length ? describeSeasons(seasonsList) : "All seasons"}>
              <p className="player-card-note">{describeStat(stat, agg)}</p>
            </PlayerCard>
          ) : (
            <div className="player-card is-league reveal">
              <div className="player-card-portrait">
                <span className="avatar avatar-xl"><GoatMark size={56} /></span>
              </div>
              <div className="player-card-body">
                <div className="eyebrow">League-wide</div>
                <h2 className="player-card-name">Every player</h2>
                <p className="player-card-note">{seasonsList.length ? describeSeasons(seasonsList) : "All seasons"}</p>
              </div>
            </div>
          )}

          <div className="stats-result-numbers">
            <StatCard
              size="xl"
              label={describeStat(stat, agg)}
              value={value}
              format={(v) => formatStat(v, stat, agg)}
              unit={stat == "games" ? "GP" : statShort(stat)}
              delay={80}
            />
            {pctValue != null && (
              <div className="stat-card percentile-card reveal" style={{ ["--d" as string]: "160ms" }}>
                <div className="stat-card-label">League percentile</div>
                <div className="stat-card-value">
                  <span className="tabular">{pctValue.toFixed(1)}</span>
                  <span className="stat-card-unit">th</span>
                </div>
                <div className="stat-card-sub">
                  <span className={`trend trend-${pctValue >= 50 ? "up" : "down"}`}>
                    {pctValue >= 50 ? <TrendUp /> : <TrendDown />}
                    Top {(100 - pctValue).toFixed(1)}%
                  </span>
                </div>
                <PercentileBar value={percentile!} />
              </div>
            )}
          </div>
        </div>
        <div className="results-actions">
          <Button to={formPath} state={{ draft }} variant="secondary">Edit query</Button>
          {displayName && (
            <Button to={gameLog} variant="ghost" arrow>
              Game log
            </Button>
          )}
        </div>
        {matched.length > 0 && (
          <ExtremeGames
            title={matchedTitle}
            rows={matched}
            highlight={stat}
            page={gamePage}
            onPage={setGamePage}
            tableRef={gameTable}
          />
        )}
        {boxScores && boxScores.length > 0 && (agg == "avg" || agg == "sum") && (
          <ResultCard
            flush
            className="stats-lines"
            title={agg == "avg" ? "Per-game averages" : "Totals"}
            eyebrow={`${boxScores.length} ${boxScores.length == 1 ? "game" : "games"}`}
          >
            <Table
              columns={summaryColumns(stat, agg)}
              rows={[summarizeGames(boxScores, agg)]}
              rowKey={() => "summary"}
            />
          </ResultCard>
        )}
      </div>
    );
  }

  if (path == "rank") {
    const rows = result as RankRow[];
    if (rows.length == 0) {
      return (
        <div className="page page-results">
          {header()}
          <EmptyState
            title="No players found"
            message="Try fewer filters or a different team."
            action={<Button to={formPath} state={{ draft }} arrow>Edit ranking</Button>}
          />
        </div>
      );
    }
    const isTop = order == "Most";
    const maxValue = Math.max(...rows.map((r) => Math.abs(r.value) || 0)) || 1;
    const podium = [...rows].sort((a, b) => a.rank - b.rank).slice(0, 3);
    /** Formats rank row values for the current stat and aggregation. */
    const format = (v: number) => formatStat(v, stat, agg);

    return (
      <div className="page page-results">
        {header(
          <>
            <Button to={formPath} state={{ draft }} variant="secondary" size="sm">
              Edit ranking
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<SwapIcon />}
              onClick={() => setResult(result.slice().reverse())}
            >
              Reverse rows
            </Button>
          </>
        )}

        {podium.length >= 3 && (
          <div className="podium">
            {podium.map((row) => (
              <Link
                key={row.name}
                to={`/players/${encodeURIComponent(row.name)}`}
                className={`podium-card rank-${row.rank} reveal`}
                style={{ ["--d" as string]: `${row.rank * 70}ms` }}
              >
                <span className="podium-rank">{String(row.rank).padStart(2, "0")}</span>
                {row.rank == 1 && isTop && (
                  <span className="goat-badge" title="The GOAT of this query">
                    <GoatMark size={14} /> GOAT
                  </span>
                )}
                <PlayerAvatar name={row.name} size="lg" />
                <span className="podium-name">{row.name}</span>
                <span className="podium-value tabular">
                  {format(row.value)}
                  <small>{statShort(stat)}</small>
                </span>
              </Link>
            ))}
          </div>
        )}

        <ResultCard flush title={describeStat(stat, agg)} eyebrow={`${isTop ? "Top" : "Bottom"} ${rows.length}`}>
          <ol className="rank-list">
            {rows.map((row, index) => (
              <li key={row.name} className="rank-row" style={{ ["--i" as string]: Math.min(index, 20) }}>
                <span className="rank-number tabular">{String(row.rank).padStart(2, "0")}</span>
                <PlayerAvatar name={row.name} size="sm" />
                <Link to={`/players/${encodeURIComponent(row.name)}`} className="rank-name">
                  {row.name}
                  {row.rank == 1 && isTop && <GoatMark size={14} className="rank-goat" title="GOAT" />}
                </Link>
                <span className="rank-bar" aria-hidden="true">
                  <i style={{ width: `${((Math.abs(row.value) || 0) / maxValue) * 100}%` }} />
                </span>
                <span className="rank-value tabular">{format(row.value)}</span>
              </li>
            ))}
          </ol>
        </ResultCard>
      </div>
    );
  }
};

export default ResultsPage;
