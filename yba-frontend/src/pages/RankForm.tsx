import { FormEvent, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FilterBuilder,
  NumberField,
  QueryCard,
  QueryControl,
  SectionHeader,
  SegmentedControl,
} from "../components/All";
import { AGG_OPTIONS, DEFAULT_STAGE, RANK_FILTER_STATS, TEAMS, statLabel } from "../constants";
import { QueryDraft, getStatInfo } from "../utilities";
import AskBox from "./AskBox";
import { SeasonPicker, StagePicker, StatPicker, TeamPicker, describeSeasons, useFptsInfo } from "./queryFields";

interface Props {
  onSubmit: (
    agg: string,
    stat: string,
    order: string,
    limit: number,
    team: string,
    seasons: string[],
    stage: string,
    filters: string[]
  ) => void;
}

/** Form for building player leaderboard queries. */
const RankForm = ({ onSubmit }: Props) => {
  const draft = (useLocation().state as { draft?: QueryDraft } | null)?.draft;
  const [aggValue, setAggValue] = useState(draft?.agg ?? "");
  const [statValue, setStatValue] = useState(draft?.stat ?? "");
  const [order, setOrder] = useState(draft?.order || "Most");
  const [limit, setLimit] = useState(draft?.limit ?? -1);
  const [team, setTeam] = useState(draft?.team ?? "");
  const [seasons, setSeasons] = useState<string[]>(draft?.seasons ?? []);
  const [stage, setStage] = useState(draft?.stage ?? DEFAULT_STAGE);
  const [filters, setFilters] = useState<string[]>(draft?.filters ?? []);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const fpts = useFptsInfo();

  /** Validates required rank fields and submits the leaderboard query. */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const missing = [
      limit == -1 ? "number of players" : "",
      !statValue ? "stat" : "",
      !aggValue ? "metric" : "",
    ].filter(Boolean);
    if (missing.length == 0) onSubmit(aggValue, statValue, order, limit, team, seasons, stage, filters);
    else if (missing.length == 1) setError(`Choose a ${missing[0]}.`);
    else if (missing.length == 2) setError(`Choose a ${missing[0]} and a ${missing[1]}.`);
    else setError("Choose a number of players, a stat, and a metric.");
  };

  /** Clears all rank form fields and validation errors. */
  const reset = () => {
    setAggValue("");
    setStatValue("");
    setOrder("Most");
    setLimit(-1);
    setTeam("");
    setSeasons([]);
    setStage(DEFAULT_STAGE);
    setFilters([]);
    setError("");
    setFormKey((k) => k + 1);
  };

  const ready = aggValue != "" && statValue != "" && limit != -1;
  const preview = ready
    ? getStatInfo("", statValue, aggValue, seasons, filters, team, limit, order, stage)
    : "Choose a number of players, a stat, and a metric.";

  return (
    <div className="page page-query">
      <SectionHeader
        size="hero"
        align="center"
        eyebrow="Rankings"
        title="Rank players"
        description="Build a leaderboard for any stat."
      />

      <AskBox
        page="rank"
        hint="A stat and a metric. The list is 10 players unless you say otherwise."
        placeholder="Top 10 scorers per game in 2023-24"
        ariaLabel="Rankings question"
        fallback="That question could not be turned into a rankings query."
        ready={(data) => Boolean(data.ok && data.stat && data.agg && data.order && data.limit && data.limit > 0)}
        onResult={(data) =>
          onSubmit(
            data.agg ?? "",
            data.stat ?? "",
            data.order ?? "",
            data.limit ?? 0,
            data.team ?? "",
            data.seasons ?? [],
            data.stage ?? "",
            data.filters ?? []
          )
        }
      />

      <QueryCard
        key={formKey}
        title="Leaderboard"
        onSubmit={handleSubmit}
        onReset={reset}
        submitLabel="Rank"
        preview={preview}
        error={error}
      >
        <QueryControl label="Order" required>
          <SegmentedControl
            ariaLabel="Order"
            value={order}
            onChange={setOrder}
            options={[
              { value: "Most", label: "Top" },
              { value: "Least", label: "Bottom" },
            ]}
          />
        </QueryControl>

        <QueryControl label="Number of players" required invalid={!!error && limit == -1}>
          <NumberField
            value={limit}
            onChange={(value) => {
              setLimit(value);
              setError("");
            }}
            presets={[5, 10, 25, 50]}
            unit="players"
          />
        </QueryControl>

        <QueryControl
          label="Stat"
          required
          value={statValue && statLabel(statValue)}
          placeholder="Choose a stat"
          popoverWidth="wide"
          invalid={!!error && !statValue}
        >
          {(close) => (
            <StatPicker
              value={statValue}
              onFptsInfo={fpts.open}
              onChange={(stat) => {
                setStatValue(stat);
                setError("");
                close();
              }}
            />
          )}
        </QueryControl>

        <QueryControl label="Team" value={team && `${team} · ${TEAMS[team]}`} placeholder="Any team" popoverWidth="wide">
          {(close) => (
            <TeamPicker
              value={team}
              onChange={(value) => {
                setTeam(value);
                close();
              }}
            />
          )}
        </QueryControl>

        <QueryControl label="Metric" required span={2} invalid={!!error && !aggValue}>
          <SegmentedControl
            ariaLabel="Metric"
            value={aggValue}
            onChange={(value) => {
              setAggValue(value);
              setError("");
            }}
            options={AGG_OPTIONS}
          />
        </QueryControl>

        <QueryControl label="Season" value={describeSeasons(seasons)} placeholder="All seasons">
          <SeasonPicker value={seasons} onChange={setSeasons} />
        </QueryControl>

        <QueryControl label="Stage">
          <StagePicker value={stage} onChange={setStage} />
        </QueryControl>

        <QueryControl label="Filters" span={2}>
          <FilterBuilder
            filters={filters}
            stats={RANK_FILTER_STATS}
            onAdd={(filter) => setFilters([...filters, filter])}
            onRemove={(indexToRemove) => setFilters(filters.filter((_, index) => index !== indexToRemove))}
            note="Filters use per-game averages."
            perGame
          />
        </QueryControl>
      </QueryCard>
      {fpts.dialog}
    </div>
  );
};

export default RankForm;
