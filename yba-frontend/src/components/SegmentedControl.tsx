import { useRef } from "react";
import { useSlidingIndicator } from "../hooks";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}

/** Radio-style segmented control with a sliding active indicator. */
const SegmentedControl = ({ options, value, onChange, size = "md", ariaLabel }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const indicator = useSlidingIndicator(ref, value);

  return (
    <div className={`segmented segmented-${size}`} ref={ref} role="radiogroup" aria-label={ariaLabel}>
      {indicator && (
        <span
          className="segmented-thumb"
          style={{
            transform: `translate(${indicator.left}px, ${indicator.top}px)`,
            width: indicator.width,
            height: indicator.height,
          }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value == option.value}
          data-active={value == option.value}
          className="segmented-option"
          disabled={option.disabled}
          title={option.hint}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default SegmentedControl;
