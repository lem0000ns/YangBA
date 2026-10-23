import { Link, useParams } from "react-router-dom";
import { getStatInfo, computeURL } from "../utilities.tsx";
import {
  ArrowLeft,
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
import { ReactNode, useState, useEffect } from "react";
import axios from "axios";
import {
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

/** Loads and renders stats, games, or rank results from URL parameters. */
const ResultsPage = ({ path }: Props) => {
  const [result, setResult] = useState<any>();
  const [statInfo, setStatInfo] = useState("");
  const [percentile, setPercentile] = useState<number | null>(null);
  const [resolvedName, setResolvedName] = useState("");
  const routeParams = useParams();
  const [error, setError] = useState("");
  const name =
    routeParams["name"] && routeParams["name"] != "na"
      ? routeParams["name"]
      : "";
  const seasons =
    routeParams["seasons"] && routeParams["seasons"] != "na"
      ? routeParams["seasons"].split("-")
      : [];
  const filters =
    routeParams["filters"] && routeParams["filters"] != "na"
      ? routeParams["filters"].split("-")
      : [];
  const limit =
    routeParams["limit"] && routeParams["limit"] != "na"
      ? Number(routeParams["limit"])
      : -1;
  const stat =
    routeParams["stat"] && routeParams["stat"] != "na"
      ? routeParams["stat"]
      : "";
  let agg =
    routeParams["agg"] && routeParams["agg"] != "na" ? routeParams["agg"] : "";
  const order =
    routeParams["order"] && routeParams["order"] != "na"
      ? routeParams["order"]
      : "";
  const team =
    routeParams["team"] && routeParams["team"] != "na"
      ? routeParams["team"]
      : "";
  const stage =
    routeParams["stage"] && routeParams["stage"] != "na"
      ? routeParams["stage"]
      : "";

  let url =
    baseURL +
    `${path}?` +
    computeURL(name, stat, agg, seasons, filters, limit, order, team, stage);

  useEffect(() => {
    if (path == "games") {
      axios
        .get(url)
        .then((response) => {
          setResult(
            (response.data.games ?? []).map((row: GameRow) => ({
              ...row,
              FPTS: row.FPTS != null ? Number(row.FPTS) : computeFPTS(row),
            }))
          );
          setStatInfo(
            getStatInfo(name, "", "", seasons, filters, "", limit, "", "")
          );
        })
        .catch((error) => {
          console.log("there was an error: " + error);
          setError("There was an error");
        });
    }

    if (path == "stats") {
      if (stat == "games") agg = "sum";
      setStatInfo(
        getStatInfo(name, stat, agg, seasons, filters, "", -1, "", "")
      );
      axios
        .get(url)
        .then((response) => {
          const value = response.data[agg + "_" + stat];
          if (typeof value != "number") throw new Error("missing stat in response");
          setResult(value);
          setResolvedName(response.data.name ?? name);
          setPercentile(response.data.percentile ? response.data.percentile : null);
        })
        .catch((error) => {
          console.error("there was an error: " + error);
          setError("There was an error");
        });
    }

    if (path == "rank") {
      setStatInfo(
        getStatInfo("", stat, agg, seasons, filters, team, limit, order, stage)
      );
      axios
        .get(url)
        .then((response) => {
          setResult(
            response.data.result.map((item: any, index: number) => ({
              rank: index + 1,
              name: item.name,
              value: item[agg + "_" + stat],
            }))
          );
        })
        .catch((error) => {
          console.error("there was an error: " + error);
          setError("There was an error");
        });
    }
  }, [baseURL]);

  const formPath = `/${path}`;
  const eyebrow = path == "stats" ? "Stats result" : path == "games" ? "Game log" : "Leaderboard";

  const contextChips = (
    <div className="context-chips">
      {seasons.length > 0 && <span className="chip is-static">{describeSeasons(seasons)}</span>}
      {team && <span className="chip is-static">{TEAMS[team] ?? team}</span>}
      {stage && <span className="chip is-static">{stage}</span>}
      {filters.map((filter, index) => (
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
          action={<Button to={formPath} arrow>Back</Button>}
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
            action={<Button to={formPath} arrow>Edit search</Button>}
          />
        </div>
      );
    }
    const points = games.map((g) => Number(g.points) || 0);
    const best = games[points.indexOf(Math.max(...points))];
    const fpts = games.map((g) => g.FPTS);
    return (
      <div className="page page-results">
        {header()}
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
        <ResultCard flush title="Stat lines" eyebrow={`${games.length} ${games.length == 1 ? "game" : "games"}`}>
          <Table columns={gameColumns(Math.max(...fpts, 1))} rows={games} rowKey={(row, i) => `${row.gameID}-${row.playerID}-${i}`} />
        </ResultCard>
      </div>
    );
  }

  if (path === "stats") {
    const value = result as number;
    const displayName = resolvedName || name;
    const pctValue = percentile != null ? percentile * 100 : null;
    const gameLog = `/games/results/${encodeURIComponent(displayName)}/${routeParams["seasons"] ?? "na"}/${routeParams["filters"] ?? "na"}/25`;

    return (
      <div className="page page-results">
        {header()}
        <div className={`stats-result ${displayName ? "" : "is-league"}`}>
          {displayName ? (
            <PlayerCard name={displayName} meta={seasons.length ? describeSeasons(seasons) : "All seasons"}>
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
                <p className="player-card-note">{seasons.length ? describeSeasons(seasons) : "All seasons"}</p>
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
          <Button to={formPath} variant="secondary">Edit query</Button>
          {displayName && (
            <Button to={gameLog} variant="ghost" arrow>
              Game log
            </Button>
          )}
        </div>
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
            action={<Button to={formPath} arrow>Edit ranking</Button>}
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
          <Button
            variant="secondary"
            size="sm"
            icon={<SwapIcon />}
            onClick={() => setResult(result.slice().reverse())}
          >
            Reverse rows
          </Button>
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
