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
import AskBox from "./AskBox";
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

  /** Submits the games query. A blank count means every matching game. */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (nameValue == "" && filters.length == 0) setError("Choose a player or add a filter.");
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
    nameValue == "" && filters.length == 0
      ? "Choose a player or add a filter."
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

      <AskBox
        page="games"
        hint="A player or a filter. Leave the count out to show every game."
        placeholder="Stephen Curry's games"
        ariaLabel="Games question"
        fallback="That question could not be turned into a games query."
        ready={(data) =>
          Boolean(data.ok && (data.name || data.filters?.length) && (data.limit == null || data.limit > 0))
        }
        onResult={(data) =>
          onSubmit(
            data.name ?? "",
            data.seasons ?? [],
            data.filters ?? [],
            data.limit == null || data.limit < 1 ? -1 : data.limit,
            data.stage ?? ""
          )
        }
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
        <QueryControl label="Number of games">
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
