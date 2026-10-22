import { useState } from "react";
import { InfoIcon, FptsInfo, PillGroup } from "../components/All";
import { QUERY_STATS, SEASONS, STAT_META, TEAMS, seasonLabel } from "../constants";
import namesList from "./allNames.txt?raw";

export const allNames = namesList.split("\n").map((n) => n.trim()).filter(Boolean);

interface StatPickerProps {
  value: string;
  onChange: (stat: string) => void;
  onFptsInfo: () => void;
}

/** Pill picker for query stats with an FPTS info trigger. */
export const StatPicker = ({ value, onChange, onFptsInfo }: StatPickerProps) => (
  <PillGroup
    selected={value}
    onChange={onChange}
    options={QUERY_STATS.map((stat) => ({
      value: stat,
      label: STAT_META[stat].label,
      group: STAT_META[stat].group,
    }))}
    renderExtra={(option) =>
      option.value == "fpts" ? (
        <button type="button" className="pill-info" onClick={onFptsInfo} aria-label="What is FPTS?">
          <InfoIcon size={14} />
        </button>
      ) : null
    }
  />
);

/** Hook state for opening the FPTS explainer modal from pickers. */
export const useFptsInfo = () => {
  const [open, setOpen] = useState(false);
  return {
    open: () => setOpen(true),
    dialog: <FptsInfo open={open} onClose={() => setOpen(false)} />,
  };
};

interface SeasonPickerProps {
  value: string[];
  onChange: (seasons: string[]) => void;
}

/** Multi-select season pills with select-all and clear actions. */
export const SeasonPicker = ({ value, onChange }: SeasonPickerProps) => {
  /** Adds or removes a season from the selected list. */
  const toggle = (season: string) =>
    onChange(
      value.includes(season)
        ? value.filter((s) => s != season)
        : [...value, season].sort()
    );

  return (
    <div className="season-picker">
      <PillGroup
        columns={3}
        selected={value}
        onChange={toggle}
        options={SEASONS.map((season) => ({ value: season, label: seasonLabel(season) }))}
      />
      <div className="popover-footer">
        <span>{value.length ? `${value.length} selected` : "All seasons"}</span>
        <div>
          <button type="button" className="text-button" onClick={() => onChange([...SEASONS])}>
            Select all
          </button>
          <button type="button" className="text-button" onClick={() => onChange([])}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

/** Formats selected seasons for compact display in query controls. */
export const describeSeasons = (seasons: string[]) => {
  if (seasons.length == 0) return "";
  if (seasons.length == 1) return seasonLabel(seasons[0]);
  const sorted = [...seasons].sort();
  const contiguous = sorted.every((s, i) => i == 0 || Number(s) - Number(sorted[i - 1]) == 1);
  if (contiguous)
    return `${seasonLabel(sorted[0]).split("–")[0]}–${seasonLabel(sorted[sorted.length - 1]).split("–")[1]}`;
  return `${seasons.length} seasons`;
};

interface TeamPickerProps {
  value: string;
  onChange: (team: string) => void;
}

/** Single-select grid of NBA team abbreviation pills. */
export const TeamPicker = ({ value, onChange }: TeamPickerProps) => (
  <PillGroup
    columns={5}
    selected={value}
    onChange={(team) => onChange(team == value ? "" : team)}
    options={Object.entries(TEAMS).map(([abbr, name]) => ({
      value: abbr,
      label: abbr,
      hint: name,
    }))}
  />
);
