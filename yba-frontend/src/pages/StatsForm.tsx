import { FormEvent, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Autocomplete,
  FilterBuilder,
  QueryCard,
  QueryControl,
  SectionHeader,
  SegmentedControl,
} from "../components/All";
import { AGG_OPTIONS, DEFAULT_STAGE, GAME_FILTER_STATS, PCT_STATS, statLabel } from "../constants";
import { QueryDraft, getStatInfo } from "../utilities";
import AskBox from "./AskBox";
import { SeasonPicker, StagePicker, StatPicker, allNames, describeSeasons, useFptsInfo } from "./queryFields";

interface Props {
  onSubmit: (
    name: string,
    stat: string,
    agg: string,
    seasons: string[],
    filters: string[],
    stage: string
  ) => void;
}

/** Form for building and submitting a single-stat query. */
const StatsForm = ({ onSubmit }: Props) => {
  const draft = (useLocation().state as { draft?: QueryDraft } | null)?.draft;
  const [nameValue, setNameValue] = useState(draft?.name ?? "");
  const [statValue, setStatValue] = useState(draft?.stat ?? "");
  const [aggValue, setAggValue] = useState(draft?.agg ?? "");
  const [seasons, setSeasons] = useState<string[]>(draft?.seasons ?? []);
  const [stage, setStage] = useState(draft?.stage ?? DEFAULT_STAGE);
  const [filters, setFilters] = useState<string[]>(draft?.filters ?? []);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const fpts = useFptsInfo();

  /** Updates stat selection and adjusts metric constraints for that stat. */
  const handleStatClick = (name: string) => {
    setStatValue(name);
    setError("");
    if (name == "games") setAggValue("sum");
    else if (PCT_STATS.includes(name) && aggValue == "sum") setAggValue("avg");
  };

  /** Sets the aggregation metric when allowed for the current stat. */
  const handleAggClick = (agg: string) => {
    if (statValue != "games") {
      setAggValue(agg);
      setError("");
    }
  };

  /** Validates required fields and calls onSubmit with form state. */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const missing = [
      !nameValue.trim() ? "player" : "",
      !statValue ? "stat" : "",
      !aggValue ? "metric" : "",
    ].filter(Boolean);
    if (missing.length == 0) onSubmit(nameValue.trim(), statValue, aggValue, seasons, filters, stage);
    else if (missing.length == 1) setError(`Choose a ${missing[0]}.`);
    else if (missing.length == 2) setError(`Choose a ${missing[0]} and a ${missing[1]}.`);
    else setError("Choose a player, a stat, and a metric.");
  };

  /** Clears all stats form fields and validation errors. */
  const reset = () => {
    setNameValue("");
    setStatValue("");
    setAggValue("");
    setSeasons([]);
    setStage(DEFAULT_STAGE);
    setFilters([]);
    setError("");
    setFormKey((k) => k + 1);
  };

  const ready = nameValue.trim() != "" && statValue != "" && aggValue != "";
  const preview = ready
    ? getStatInfo(nameValue, statValue, aggValue, seasons, filters, "", -1, "", stage)
    : "Choose a player, a stat, and a metric.";

  return (
    <div className="page page-query">
      <SectionHeader
        size="hero"
        align="center"
        eyebrow="Stats"
        title="Explore the NBA"
        description="Look up any stat for a player."
      />

      <AskBox
        page="stats"
        hint="One player, one stat."
        placeholder="Search up stats from your favorite player"
        ariaLabel="Stats question"
        fallback="That question could not be turned into a stats query."
        ready={(data) => Boolean(data.ok && data.name && data.stat && data.agg)}
        onResult={(data) =>
          onSubmit(data.name ?? "", data.stat ?? "", data.agg ?? "", data.seasons ?? [], data.filters ?? [], data.stage ?? "")
        }
      />

      <QueryCard
        key={formKey}
        title="Stat query"
        onSubmit={handleSubmit}
        onReset={reset}
        submitLabel="Search"
        preview={preview}
        error={error}
      >
        <QueryControl label="Player" span={2} required invalid={!!error && !nameValue.trim()}>
          <Autocomplete
            possibleValues={allNames}
            initialValue={nameValue}
            onChange={(value) => {
              setNameValue(value);
              setError("");
            }}
            placeholder="Choose a player"
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
                handleStatClick(stat);
                close();
              }}
            />
          )}
        </QueryControl>

        <QueryControl label="Season" value={describeSeasons(seasons)} placeholder="All seasons">
          <SeasonPicker value={seasons} onChange={setSeasons} />
        </QueryControl>

        <QueryControl label="Stage" span={2}>
          <StagePicker value={stage} onChange={setStage} />
        </QueryControl>

        <QueryControl label="Metric" required span={2} invalid={!!error && !aggValue}>
          <SegmentedControl
            ariaLabel="Metric"
            value={aggValue}
            onChange={handleAggClick}
            options={AGG_OPTIONS.map((option) => ({
              ...option,
              disabled:
                (statValue == "games" && option.value != "sum") ||
                (PCT_STATS.includes(statValue) && option.value == "sum"),
              hint: statValue == "games" ? "Games played is always a total" : undefined,
            }))}
          />
        </QueryControl>

        <QueryControl label="Filters" span={2}>
          <FilterBuilder
            filters={filters}
            stats={GAME_FILTER_STATS}
            onAdd={(filter) => setFilters([...filters, filter])}
            onRemove={(indexToRemove) => setFilters(filters.filter((_, index) => index !== indexToRemove))}
            note="Only games that match are counted."
          />
        </QueryControl>
      </QueryCard>
      {fpts.dialog}
    </div>
  );
};

export default StatsForm;
