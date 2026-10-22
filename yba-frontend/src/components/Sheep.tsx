interface ShapeProps {
  wool?: string;
  face?: string;
}

/** Side-view sheep SVG shapes for patterns and mascots. */
export const SheepShape = ({
  wool = "currentColor",
  face = "currentColor",
}: ShapeProps) => (
  <>
    <g style={{ fill: face }}>
      <rect x="10" y="18" width="2.2" height="8" rx="1.1" />
      <rect x="14.2" y="19" width="2.2" height="7" rx="1.1" />
      <rect x="20.6" y="19" width="2.2" height="7" rx="1.1" />
      <rect x="24.8" y="18" width="2.2" height="8" rx="1.1" />
      <ellipse cx="31.4" cy="11.2" rx="4.3" ry="3.3" transform="rotate(20 31.4 11.2)" />
      <ellipse cx="29.2" cy="7.4" rx="2.3" ry="1.05" transform="rotate(-32 29.2 7.4)" />
    </g>
    <g style={{ fill: wool }}>
      <circle cx="5.6" cy="12.4" r="2.4" />
      <circle cx="11.5" cy="13" r="6" />
      <circle cx="17.6" cy="10.2" r="6.6" />
      <circle cx="23.6" cy="12.2" r="5.9" />
      <circle cx="15.4" cy="16.4" r="5.4" />
      <circle cx="21.6" cy="16.6" r="5" />
      <circle cx="9.2" cy="16.8" r="4.4" />
    </g>
  </>
);

interface MarkProps {
  size?: number;
  className?: string;
  wool?: string;
  face?: string;
  title?: string;
}

/** Scaled sheep mascot SVG wrapper around SheepShape. */
export const SheepMark = ({
  size = 40,
  className,
  wool,
  face,
  title,
}: MarkProps) => (
  <svg
    width={size}
    height={(size * 28) / 40}
    viewBox="0 0 40 28"
    className={className}
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
  >
    {title && <title>{title}</title>}
    <SheepShape wool={wool} face={face} />
  </svg>
);

/** Front-facing ram head SVG used as the YangBA logo mark. */
export const GoatMark = ({ size = 28, className, title }: MarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    className={className}
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
  >
    {title && <title>{title}</title>}
    <g
      className="goat-horns"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <path d="M11.4 10.2C7 7.6 3.2 10.6 4.4 14.8c.9 3.1 4.9 3.4 5.6.6.5-1.9-1-3.1-2.4-2.4" />
      <path d="M20.6 10.2c4.4-2.6 8.2.4 7 4.6-.9 3.1-4.9 3.4-5.6.6-.5-1.9 1-3.1 2.4-2.4" />
    </g>
    <path
      fill="currentColor"
      d="M16 9.6c4.3 0 6 3.3 5.6 7.4-.5 4.6-2.6 8.6-5.6 8.6s-5.1-4-5.6-8.6C10 12.9 11.7 9.6 16 9.6z"
    />
    <g fill="currentColor">
      <circle cx="12.6" cy="8.6" r="3" />
      <circle cx="16" cy="7.2" r="3.4" />
      <circle cx="19.4" cy="8.6" r="3" />
    </g>
    <g style={{ fill: "var(--goat-eye, #fbf8f2)" }}>
      <circle cx="13.9" cy="15.6" r="1.05" />
      <circle cx="18.1" cy="15.6" r="1.05" />
      <ellipse cx="16" cy="22.3" rx="1.7" ry="0.8" opacity="0.55" />
    </g>
  </svg>
);
