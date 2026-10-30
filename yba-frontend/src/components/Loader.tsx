import { SheepMark } from "./Sheep";

interface Props {
  label?: string;
  /** Shorter indicator for a card, rather than a whole page. */
  compact?: boolean;
}

/** Animated loading indicator with an optional status label. */
const Loader = ({ label = "Counting sheep", compact = false }: Props) => (
  <div className={`loader ${compact ? "is-compact" : ""}`} role="status" aria-live="polite">
    <div className="loader-flock" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <SheepMark key={i} size={compact ? 26 : 34} wool="var(--wool-ink)" face="var(--ink)" className={`loader-sheep s${i}`} />
      ))}
    </div>
    <span className="loader-label">
      {label}
      <span className="loader-dots" />
    </span>
  </div>
);

export default Loader;
