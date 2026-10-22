import { describeFilter } from "../constants";
import { CloseIcon } from "./Icons";

interface Props {
  filter: string;
  perGame?: boolean;
  onRemove?: () => void;
}

/** Displays a human-readable filter chip with optional remove control. */
const FilterPill = ({ filter, perGame, onRemove }: Props) => {
  const label = describeFilter(filter, perGame);
  return (
    <span className="filter-pill">
      <span className="filter-pill-text">{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove filter: ${label}`}>
          <CloseIcon size={11} />
        </button>
      )}
    </span>
  );
};

export default FilterPill;
