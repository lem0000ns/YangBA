import { FormEvent, useState } from "react";
import {
  Autocomplete,
  FilterBuilder,
  NumberField,
  QueryCard,
  QueryControl,
  SectionHeader,
} from "../components/All";
import { GAME_FILTER_STATS } from "../constants";
import { getStatInfo } from "../utilities";
import { SeasonPicker, allNames, describeSeasons } from "./queryFields";

interface Props {
  onSubmit: (
    name: string,
    seasons: string[],
    filters: string[],
    limit: number
  ) => void;
}

const GamesForm = ({ onSubmit }: Props) => {
  const [nameValue, setNameValue] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [limit, setLimit] = useState(-1);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (limit == -1) setError("'Number of games' is a required field");
    else onSubmit(nameValue, seasons, filters, limit);
  };

  const reset = () => {
    setNameValue("");
    setSeasons([]);
    setFilters([]);
    setLimit(-1);
    setError("");
    setFormKey((k) => k + 1);
  };

  const preview =
    limit == -1
      ? "Choose how many games to show."
      : getStatInfo(nameValue, "", "", seasons, filters, "", limit, "", "");

  return (
    <div className="page page-query">
      <SectionHeader
        size="hero"
        align="center"
        eyebrow="Games"
        title="Find games"
        description="Get box scores that match your filters."
      />

      <QueryCard
        key={formKey}
        title="Game search"
        onSubmit={handleSubmit}
        onReset={reset}
        submitLabel="Search"
        preview={preview}
        error={error}
      >
        <QueryControl label="Number of games" required invalid={!!error && limit == -1}>
          <NumberField
            value={limit}
            onChange={(value) => {
              setLimit(value);
              setError("");
            }}
            presets={[10, 25, 50, 100]}
            unit="games"
          />
        </QueryControl>

        <QueryControl label="Season" value={describeSeasons(seasons)} placeholder="All seasons">
          <SeasonPicker value={seasons} onChange={setSeasons} />
        </QueryControl>

        <QueryControl label="Player" span={2}>
          <Autocomplete possibleValues={allNames} onChange={(value) => setNameValue(value)} placeholder="All players" />
        </QueryControl>

        <QueryControl label="Filters" span={2}>
          <FilterBuilder
            filters={filters}
            stats={GAME_FILTER_STATS}
            onAdd={(filter) => setFilters([...filters, filter])}
            onRemove={(indexToRemove) => setFilters(filters.filter((_, index) => index !== indexToRemove))}
            note="Each filter applies to a single game."
          />
        </QueryControl>
      </QueryCard>
    </div>
  );
};

export default GamesForm;
