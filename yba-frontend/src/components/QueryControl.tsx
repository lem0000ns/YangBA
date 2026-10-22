import { ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useClickOutside } from "../hooks";
import { ChevronDown } from "./Icons";

interface Props {
  label: string;
  required?: boolean;
  value?: ReactNode;
  placeholder?: string;
  span?: 1 | 2;
  popoverWidth?: "auto" | "wide";
  invalid?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}

/*
 * A labelled query "slot". When `value` is provided the tile opens a popover
 * containing `children`; otherwise `children` render inline beneath the label.
 */
const QueryControl = ({
  label,
  required = false,
  value,
  placeholder = "Choose…",
  span = 1,
  popoverWidth = "auto",
  invalid = false,
  children,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  useLayoutEffect(() => {
    if (!open || !popoverRef.current || !ref.current) return;
    const tile = ref.current.getBoundingClientRect();
    const width = popoverRef.current.offsetWidth;
    setAlignRight(tile.left + width > window.innerWidth - 16 && tile.right - width >= 16);
  }, [open]);

  const isPopover = value !== undefined;
  const hasValue = isPopover && value !== "" && value !== null && value !== false;
  const body = typeof children == "function" ? children(close) : children;

  return (
    <div
      ref={ref}
      className={[
        "query-control",
        `span-${span}`,
        isPopover ? "is-popover" : "is-inline",
        open ? "is-open" : "",
        hasValue ? "has-value" : "",
        invalid ? "is-invalid" : "",
      ].join(" ")}
    >
      {isPopover ? (
        <button
          type="button"
          className="query-control-trigger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="query-control-label">
            {label}
            <span className="query-control-tag">{required ? "Required" : "Optional"}</span>
          </span>
          <span className="query-control-value">
            {hasValue ? (
              <span className="query-control-value-text" key={String(value)}>
                {value}
              </span>
            ) : (
              <span className="query-control-placeholder">{placeholder}</span>
            )}
            <ChevronDown className="query-control-chevron" />
          </span>
        </button>
      ) : (
        <div className="query-control-trigger">
          <span className="query-control-label">
            {label}
            <span className="query-control-tag">{required ? "Required" : "Optional"}</span>
          </span>
          <div className="query-control-inline">{body}</div>
        </div>
      )}

      {isPopover && open && (
        <div
          ref={popoverRef}
          className={`query-popover popover-${popoverWidth} ${alignRight ? "align-right" : ""}`}
          role="dialog"
          aria-label={label}
        >
          {body}
        </div>
      )}
    </div>
  );
};

export default QueryControl;
