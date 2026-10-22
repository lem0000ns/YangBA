import { FormEvent, useState } from "react";
import {
  Autocomplete,
  FilterBuilder,
  QueryCard,
  QueryControl,
  SectionHeader,
  SegmentedControl,
} from "../components/All";
import { AGG_OPTIONS, GAME_FILTER_STATS, PCT_STATS, statLabel } from "../constants";
import { getStatInfo } from "../utilities";
import { SeasonPicker, StatPicker, allNames, describeSeasons, useFptsInfo } from "./queryFields";

interface Props {
  onSubmit: (
    name: string,
    stat: string,
    agg: string,
    seasons: string[],
    filters: string[]
  ) => void;
}

const StatsForm = ({ onSubmit }: Props) => {
  const [nameValue, setNameValue] = useState("");
  const [statValue, setStatValue] = useState("");
  const [aggValue, setAggValue] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const fpts = useFptsInfo();

  const handleStatClick = (name: string) => {
    setStatValue(name);
    setError("");
    if (name == "games") setAggValue("sum");
    else if (PCT_STATS.includes(name) && aggValue == "sum") setAggValue("avg");
  };

  const handleAggClick = (agg: string) => {
    if (statValue != "games") {
      setAggValue(agg);
      setError("");
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    statValue == "" || aggValue == ""
      ? setError("'Stat' and 'Agg' are required fields")
      : onSubmit(nameValue, statValue, aggValue, seasons, filters);
  };

  const reset = () => {
    setNameValue("");
    setStatValue("");
    setAggValue("");
    setSeasons([]);
    setFilters([]);
    setError("");
    setFormKey((k) => k + 1);
  };

  const ready = statValue != "" && aggValue != "";
  const preview = ready
    ? getStatInfo(nameValue, statValue, aggValue, seasons, filters, "", -1, "", "")
    : "Choose a stat and a metric.";

  return (
    <div className="page page-query">
      <SectionHeader
        size="hero"
        align="center"
        eyebrow="Stats"
        title="Explore the NBA"
        description="Look up any stat for a player or the whole league."
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
        <QueryControl label="Player" span={2}>
          <Autocomplete possibleValues={allNames} onChange={(value) => setNameValue(value)} placeholder="All players" />
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
