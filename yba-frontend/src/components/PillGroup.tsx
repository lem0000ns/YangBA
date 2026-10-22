import { ReactNode } from "react";

export interface PillOption {
  value: string;
  label: ReactNode;
  group?: string;
  hint?: string;
  disabled?: boolean;
}

interface Props {
  options: PillOption[];
  selected: string | string[];
  onChange: (value: string) => void;
  renderExtra?: (option: PillOption) => ReactNode;
  columns?: number;
}

const PillGroup = ({ options, selected, onChange, renderExtra, columns }: Props) => {
  const isSelected = (value: string) =>
    Array.isArray(selected) ? selected.includes(value) : selected == value;

  const groups: { name?: string; items: PillOption[] }[] = [];
  options.forEach((option) => {
    const last = groups[groups.length - 1];
    if (last && last.name == option.group) last.items.push(option);
    else groups.push({ name: option.group, items: [option] });
  });

  return (
    <div className="pill-group">
      {groups.map((group) => (
        <div className="pill-group-section" key={group.name ?? "all"}>
          {group.name && <div className="pill-group-heading">{group.name}</div>}
          <div
            className="pill-group-items"
            style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
            data-grid={columns ? "true" : undefined}
          >
            {group.items.map((option) => (
              <span className="pill-wrap" key={option.value}>
                <button
                  type="button"
                  className={`pill ${isSelected(option.value) ? "is-selected" : ""}`}
                  onClick={() => onChange(option.value)}
                  disabled={option.disabled}
                  title={option.hint}
                  aria-pressed={isSelected(option.value)}
                >
                  {option.label}
                </button>
                {renderExtra?.(option)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PillGroup;
