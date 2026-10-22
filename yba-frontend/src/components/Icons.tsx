interface IconProps {
  size?: number;
  className?: string;
}

/** Shared SVG attributes for stroke icons at a given size. */
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** Magnifying glass icon. */
export const SearchIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

/** Downward chevron icon. */
export const ChevronDown = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 9.5l6 6 6-6" />
  </svg>
);

/** Right arrow icon. */
export const ArrowRight = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Left arrow icon. */
export const ArrowLeft = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

/** Upward trend line icon. */
export const TrendUp = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 16l6-6 4 4 6-7M14 7h6v6" />
  </svg>
);

/** Downward trend line icon. */
export const TrendDown = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 8l6 6 4-4 6 7M14 17h6v-6" />
  </svg>
);

/** Close (X) icon. */
export const CloseIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/** Plus icon. */
export const PlusIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** Minus icon. */
export const MinusIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14" />
  </svg>
);

/** Information circle icon. */
export const InfoIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

/** Vertical swap arrows icon. */
export const SwapIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" />
  </svg>
);
