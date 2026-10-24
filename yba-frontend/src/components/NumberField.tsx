import { MinusIcon, PlusIcon } from "./Icons";

interface Props {
  value: number;
  onChange: (value: number) => void;
  presets?: number[];
  unit?: string;
  min?: number;
  max?: number;
}

/** Numeric input with steppers, presets, and -1 as unset for required fields. */
const NumberField = ({ value, onChange, presets = [], unit, min = 1, max = 500 }: Props) => {
  /** Clamps a number to the configured min and max. */
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  /** Increments or decrements the value by delta within bounds. */
  const step = (delta: number) => onChange(clamp((value == -1 ? 0 : value) + delta));

  return (
    <div className="number-field">
      <div className="number-input">
        <button type="button" onClick={() => step(-1)} aria-label="Decrease" disabled={value != -1 && value <= min}>
          <MinusIcon />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value == -1 ? "" : value}
          onChange={(e) => onChange(e.target.value == "" ? -1 : clamp(Number(e.target.value)))}
        />
        {unit && <span className="number-unit">{unit}</span>}
        <button type="button" onClick={() => step(1)} aria-label="Increase">
          <PlusIcon />
        </button>
      </div>
      {presets.length > 0 && (
        <div className="number-presets">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset}
              className={`chip ${value == preset ? "is-selected" : ""}`}
              onClick={() => onChange(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NumberField;
