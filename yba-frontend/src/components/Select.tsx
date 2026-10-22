import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "../hooks";
import { ChevronDown } from "./Icons";

interface Props {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const Select = ({ options, value, onChange, placeholder = "Select", ariaLabel }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  const current = options.find((o) => o.value == value);

  return (
    <div className={`select ${open ? "is-open" : ""}`} ref={ref}>
      <button
        type="button"
        className="select-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={current ? "" : "select-placeholder"}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <ul className="select-menu" role="listbox">
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value == value}
              className={option.value == value ? "is-selected" : ""}
              onClick={() => {
                onChange(option.value);
                close();
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Select;
