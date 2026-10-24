import { useId, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../hooks";
import { CloseIcon, SearchIcon } from "./Icons";

interface Props {
  possibleValues: string[];
  onChange: (value: string) => void;
  onSubmitEmpty?: () => void;
  initialValue?: string;
  placeholder?: string;
  variant?: "field" | "search";
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

const MAX_SUGGESTIONS = 8;

/** Highlights the matching substring in suggestion text. */
const highlight = (text: string, query: string) => {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index == -1 || !query) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
};

/** Player name combobox with filtered suggestions and keyboard navigation. */
const Autocomplete = ({
  possibleValues,
  onChange,
  onSubmitEmpty,
  initialValue = "",
  placeholder = "Search for a player…",
  variant = "field",
  autoFocus,
  inputRef,
}: Props) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(initialValue);
  const listId = useId();

  const suggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return [];
    return possibleValues
      .filter((name) => name && name.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [inputValue, possibleValues]);

  useClickOutside(wrapperRef, open, () => setOpen(false));

  /** Applies a chosen suggestion and notifies the parent. */
  const select = (value: string) => {
    setInputValue(variant == "search" ? "" : value);
    setOpen(false);
    selectedRef.current = variant == "search" ? "" : value;
    onChange(value);
  };

  /** Updates input state and opens the suggestion list while typing. */
  const handleTyping = (value: string) => {
    setInputValue(value);
    setHighlighted(0);
    setOpen(true);
    if (variant == "field" && selectedRef.current && value != selectedRef.current) {
      selectedRef.current = "";
      onChange("");
    }
  };

  /** Selects an exact name match when the field loses focus. */
  const handleBlur = () => {
    if (variant != "field" || selectedRef.current) return;
    const typed = inputValue.trim().toLowerCase();
    const exact = possibleValues.find((name) => name.toLowerCase() == typed);
    if (typed && exact) select(exact);
  };

  /** Handles arrow keys, Enter, and Escape for suggestion navigation. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key == "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key == "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key == "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) select(suggestions[highlighted]);
      else if (!inputValue.trim()) onSubmitEmpty?.();
    } else if (e.key == "Escape") {
      setOpen(false);
    }
  };

  /** Clears the input and resets the selected value. */
  const clear = () => {
    setInputValue("");
    setOpen(false);
    selectedRef.current = "";
    if (variant == "field") onChange("");
  };

  return (
    <div className={`autocomplete autocomplete-${variant}`} ref={wrapperRef}>
      <div className="autocomplete-control">
        <SearchIcon size={16} className="autocomplete-icon" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          autoFocus={autoFocus}
          onChange={(e) => handleTyping(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
        />
        {inputValue && (
          <button
            type="button"
            className="autocomplete-clear"
            onClick={clear}
            aria-label="Clear"
          >
            <CloseIcon size={12} />
          </button>
        )}
        {variant == "search" && !inputValue && (
          <kbd className="autocomplete-kbd">/</kbd>
        )}
      </div>
      {open && inputValue.trim() && (
        <ul className="suggestions" id={listId} role="listbox">
          {suggestions.length == 0 ? (
            <li className="suggestions-empty">No players match “{inputValue}”</li>
          ) : (
            suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                role="option"
                aria-selected={index == highlighted}
                className={index == highlighted ? "is-highlighted" : ""}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(suggestion);
                }}
              >
                {highlight(suggestion, inputValue.trim())}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default Autocomplete;
