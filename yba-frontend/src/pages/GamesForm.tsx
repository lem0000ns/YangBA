import { FormEvent, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Autocomplete,
  FilterBuilder,
  NumberField,
  QueryCard,
  QueryControl,
  SectionHeader,
} from "../components/All";
import { DEFAULT_STAGE, GAME_FILTER_STATS } from "../constants";
import { QueryDraft, getStatInfo } from "../utilities";
import { SeasonPicker, StagePicker, allNames, describeSeasons } from "./queryFields";

interface Props {
  onSubmit: (
    name: string,
    seasons: string[],
    filters: string[],
    limit: number,
    stage: string
  ) => void;
}

/** Form for searching game logs with filters and a result limit. */
const GamesForm = ({ onSubmit }: Props) => {
  const draft = (useLocation().state as { draft?: QueryDraft } | null)?.draft;
  const [nameValue, setNameValue] = useState(draft?.name ?? "");
  const [seasons, setSeasons] = useState<string[]>(draft?.seasons ?? []);
  const [stage, setStage] = useState(draft?.stage ?? DEFAULT_STAGE);
  const [filters, setFilters] = useState<string[]>(draft?.filters ?? []);
  const [limit, setLimit] = useState(draft?.limit ?? -1);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);

  /** Validates the game limit and submits the games query. */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const missingScope = nameValue == "" && filters.length == 0;
    if (limit == -1 && missingScope) setError("Choose how many games to show, and a player or a filter.");
    else if (limit == -1) setError("Choose how many games to show.");
    else if (missingScope) setError("Choose a player or add a filter.");
    else onSubmit(nameValue, seasons, filters, limit, stage);
  };

  /** Clears all games form fields and validation errors. */
  const reset = () => {
    setNameValue("");
    setSeasons([]);
    setStage(DEFAULT_STAGE);
    setFilters([]);
    setLimit(-1);
    setError("");
    setFormKey((k) => k + 1);
  };

  const preview =
    limit == -1
      ? "Choose how many games to show."
      : getStatInfo(nameValue, "", "", seasons, filters, "", limit, "", stage);

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

        <QueryControl label="Player" span={2} invalid={!!error && nameValue == "" && filters.length == 0}>
          <Autocomplete
            possibleValues={allNames}
            initialValue={nameValue}
            onChange={(value) => {
              setNameValue(value);
              setError("");
            }}
            placeholder="All players"
          />
        </QueryControl>

        <QueryControl label="Stage" span={2}>
          <StagePicker value={stage} onChange={setStage} />
        </QueryControl>

        <QueryControl label="Filters" span={2} invalid={!!error && nameValue == "" && filters.length == 0}>
          <FilterBuilder
            filters={filters}
            stats={GAME_FILTER_STATS}
            onAdd={(filter) => {
              setFilters([...filters, filter]);
              setError("");
            }}
            onRemove={(indexToRemove) => setFilters(filters.filter((_, index) => index !== indexToRemove))}
            note="Each filter applies to a single game."
          />
        </QueryControl>
      </QueryCard>
    </div>
  );
};

export default GamesForm;
