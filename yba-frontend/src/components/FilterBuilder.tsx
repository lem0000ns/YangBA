import { useState } from "react";
import { PCT_STATS, statLabel } from "../constants";
import FilterPill from "./FilterPill";
import { PlusIcon } from "./Icons";
import SegmentedControl from "./SegmentedControl";
import Select from "./Select";

interface Props {
  filters: string[];
  stats: string[];
  onAdd: (filter: string) => void;
  onRemove: (index: number) => void;
  note?: string;
  perGame?: boolean;
}

const hintFor = (stat: string) => {
  if (PCT_STATS.includes(stat)) return "Enter percentages as decimals (0.40 = 40%).";
  if (stat == "stage") return "1 = preseason, 2 = regular season, 3–5 = playoffs.";
  return "";
};

const FilterBuilder = ({ filters, stats, onAdd, onRemove, note, perGame }: Props) => {
  const [composing, setComposing] = useState(false);
  const [stat, setStat] = useState(stats[0]);
  const [op, setOp] = useState(">");
  const [num, setNum] = useState("");

  const add = () => {
    if (num.trim() == "" || Number.isNaN(Number(num))) return;
    onAdd(`${stat}${op}${num.trim()}`);
    setNum("");
    setComposing(false);
  };

  return (
    <div className="filter-builder">
      <div className="filter-builder-row">
        {filters.map((filter, index) => (
          <FilterPill key={`${filter}-${index}`} filter={filter} perGame={perGame} onRemove={() => onRemove(index)} />
        ))}
        {!composing && (
          <button type="button" className="add-filter" onClick={() => setComposing(true)}>
            <PlusIcon size={13} />
            {filters.length ? "Add another" : "Add filter"}
          </button>
        )}
        {!composing && filters.length == 0 && (
          <span className="filter-builder-empty">No filters</span>
        )}
      </div>

      {composing && (
        <div className="filter-composer">
          <Select
            ariaLabel="Filter stat"
            options={stats.map((s) => ({ value: s, label: statLabel(s) }))}
            value={stat}
            onChange={setStat}
          />
          <SegmentedControl
            size="sm"
            ariaLabel="Comparison"
            value={op}
            onChange={setOp}
            options={[
              { value: ">", label: "more than" },
              { value: "<", label: "less than" },
              { value: "=", label: "exactly" },
            ]}
          />
          <input
            className="text-input filter-composer-num"
            type="number"
            step="any"
            inputMode="decimal"
            placeholder={PCT_STATS.includes(stat) ? "0.40" : "30"}
            value={num}
            autoFocus
            onChange={(e) => setNum(e.target.value)}
            onKeyDown={(e) => {
              if (e.key == "Enter" || e.key == ",") {
                e.preventDefault();
                add();
              }
              if (e.key == "Escape") setComposing(false);
            }}
          />
          <div className="filter-composer-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setComposing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={add}
              disabled={num.trim() == "" || Number.isNaN(Number(num))}
            >
              Add
            </button>
          </div>
          {(hintFor(stat) || note) && (
            <p className="filter-composer-hint">{[hintFor(stat), note].filter(Boolean).join(" ")}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;
